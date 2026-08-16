import { isValidNational10, national10, formatE164, countryCodeOf } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { roundKg, toKg } from '../lib/decimal.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { loadSubmissionForActor, requireStaff } from '../lib/access.js';
import { withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';

export interface TeamMemberInput {
  name: string;
  role: string;
  phone: string;
}

export interface AddVehicleInput {
  registration: string;
  vehicleType: string;
  logisticsPartner?: string;
  driverName: string;
  driverPhone: string;
  expectedAt?: string;
  team: TeamMemberInput[];
}

export interface WeighmentInput {
  manual?: boolean;
  gross?: number;
  tare?: number;
  net?: number;
  slipNumber?: string;
  method?: string;
  reason?: string;
  weighedAt: string;
  slipPhotoIds?: string[];
  pickupPhotoIds?: string[];
}

export async function addVehicle(
  actor: SessionUser,
  submissionId: string,
  input: AddVehicleInput,
) {
  requireStaff(actor);
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (!sub.acknowledgedAt) {
    throw new AppError('Acknowledge the request before assigning vehicles.');
  }

  if (!input.team?.length) {
    throw new AppError('Every vehicle needs at least one team member with name, role and phone.');
  }

  const driverPhone = requireMobile(input.driverPhone, 'Driver phone');

  for (const member of input.team) {
    if (!member.name?.trim() || !member.role?.trim() || !member.phone?.trim()) {
      throw new AppError('Every team member needs a name, role and phone.');
    }
    requireMobile(member.phone, 'Team member phone');
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      submissionId,
      registration: input.registration.trim().toUpperCase(),
      vehicleType: input.vehicleType,
      logisticsPartner: input.logisticsPartner ?? null,
      driverName: input.driverName.trim(),
      driverPhone,
      expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
      team: {
        create: input.team.map((m) => ({
          name: m.name.trim(),
          role: m.role.trim(),
          phone: requireMobile(m.phone, 'Team member phone'),
        })),
      },
    },
    include: { team: true, weighment: true },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'veh.add',
    entity: 'vehicle',
    entityId: vehicle.id,
    details: { submissionId, reg: vehicle.registration, team: vehicle.team.length },
  });

  const refreshed = await loadSubmissionForActor(submissionId, actor);
  return { vehicle, submission: withDerivedStages(refreshed) };
}

export async function recordWeighment(
  actor: SessionUser,
  vehicleId: string,
  input: WeighmentInput,
) {
  requireStaff(actor);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { submission: true, weighment: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);
  if (vehicle.weighment) throw new AppError('This vehicle already has a weighment recorded.');

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);

  let data;
  if (input.manual) {
    const net = toKg(input.net);
    if (!(net > 0)) throw new AppError('Enter the weight recorded manually.');
    if (!input.reason?.trim()) {
      throw new AppError(
        'Record why the weighbridge was not used — this is what makes the manual figure auditable.',
      );
    }
    if (!input.pickupPhotoIds?.length) {
      throw new AppError('At least one pickup photo is still required for a manual weighment.');
    }
    await assertFilesExist(input.pickupPhotoIds, ['pickPhoto']);
    data = {
      manual: true,
      grossKg: null,
      tareKg: null,
      netKg: roundKg(net),
      slipNumber: null,
      method: (input.method || 'Floor scale').trim(),
      reason: input.reason.trim(),
      weighedAt: new Date(input.weighedAt),
      slipPhotoIds: [],
      pickupPhotoIds: input.pickupPhotoIds,
      createdBy: actor.email,
    };
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'veh.weigh.manual',
      entity: 'vehicle',
      entityId: vehicleId,
      details: { submissionId: sub.id, net: data.netKg, reason: data.reason, method: data.method },
    });
  } else {
    if (!input.slipPhotoIds?.length) {
      throw new AppError('At least one weighment slip photo is required.');
    }
    if (!input.pickupPhotoIds?.length) {
      throw new AppError('At least one pickup photo is required.');
    }
    await assertFilesExist(input.slipPhotoIds, ['weighPhoto']);
    await assertFilesExist(input.pickupPhotoIds, ['pickPhoto']);
    const gross = toKg(input.gross);
    const tare = toKg(input.tare);
    if (!(gross > tare)) throw new AppError('Gross weight must be greater than tare weight.');
    if (!input.slipNumber?.trim()) throw new AppError('Weighment slip number is required.');

    data = {
      manual: false,
      grossKg: roundKg(gross),
      tareKg: roundKg(tare),
      netKg: roundKg(gross - tare),
      slipNumber: input.slipNumber.trim(),
      method: null,
      reason: null,
      weighedAt: new Date(input.weighedAt),
      slipPhotoIds: input.slipPhotoIds,
      pickupPhotoIds: input.pickupPhotoIds,
      createdBy: actor.email,
    };
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'veh.weigh',
      entity: 'vehicle',
      entityId: vehicleId,
      details: { submissionId: sub.id, net: data.netKg, slip: data.slipNumber },
    });
  }

  const weighment = await prisma.weighment.create({
    data: { vehicleId, ...data },
  });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { weighment, submission: withDerivedStages(refreshed) };
}

function requireMobile(raw: string, label: string): string {
  if (!isValidNational10(raw)) {
    throw new AppError(`${label} must be a 10-digit mobile number.`);
  }
  return formatE164(national10(raw), countryCodeOf(raw));
}
