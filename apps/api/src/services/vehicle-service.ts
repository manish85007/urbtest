import { isValidNational10, national10, formatE164, countryCodeOf } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { roundKg, toKg } from '../lib/decimal.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { loadSubmissionForActor, requireStaff } from '../lib/access.js';
import { deriveSubmissionStage, withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';
import { sendTransactionalEmail } from './email.js';
import { stageLabel } from '@urb-tectrack/shared';

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
  changeRemark?: string;
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

async function emailStageChange(
  beforeStage: number,
  refreshed: Awaited<ReturnType<typeof loadSubmissionForActor>>,
  detail: string,
) {
  const afterStage = deriveSubmissionStage(refreshed);
  if (afterStage === beforeStage) return;
  await sendTransactionalEmail('request_stage_update', [refreshed.createdBy], {
    request_id: refreshed.id,
    site_name: refreshed.site.name,
    contact_name: refreshed.createdBy,
    stage_name: stageLabel(afterStage),
    status_detail: detail,
  });
}

export async function addVehicle(
  actor: SessionUser,
  submissionId: string,
  input: AddVehicleInput,
) {
  requireStaff(actor);
  const sub = await loadSubmissionForActor(submissionId, actor);
  const beforeStage = deriveSubmissionStage(sub);
  if (!sub.acknowledgedAt) {
    throw new AppError('Acknowledge the request before assigning vehicles.');
  }

  const driverPhone = requireMobile(input.driverPhone, 'Driver phone');

  const extraTeam = (input.team ?? []).filter((m) => m.name?.trim() && m.phone?.trim());
  for (const member of extraTeam) {
    if (!member.role?.trim()) {
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
        create: extraTeam.map((m) => ({
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

  await sendTransactionalEmail('vehicle_assigned', [refreshed.createdBy], {
    request_id: refreshed.id,
    client_name: refreshed.client.name,
    site_name: refreshed.site.name,
    expected_date: input.expectedAt
      ? new Date(input.expectedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '(TBD)',
    registration: vehicle.registration,
    driver_name: input.driverName.trim(),
    driver_phone: input.driverPhone,
    contact_name: refreshed.createdBy,
  });
  await emailStageChange(beforeStage, refreshed, `Pickup scheduled for ${vehicle.registration}.`);

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

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);
  const beforeStage = deriveSubmissionStage(sub);

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

  const weighment = vehicle.weighment
    ? await prisma.weighment.update({
        where: { vehicleId },
        data,
      })
    : await prisma.weighment.create({
        data: { vehicleId, ...data },
      });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  await emailStageChange(beforeStage, refreshed, `Weighment recorded for ${vehicle.registration}.`);
  return { weighment, submission: withDerivedStages(refreshed) };
}

export async function updateVehicle(
  actor: SessionUser,
  vehicleId: string,
  input: AddVehicleInput,
) {
  requireStaff(actor);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { submission: true, team: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed — vehicle details can no longer be changed.');
  }

  const driverPhone = requireMobile(input.driverPhone, 'Driver phone');
  const extraTeam = (input.team ?? []).filter((m) => m.name?.trim() && m.phone?.trim());
  for (const member of extraTeam) {
    if (!member.role?.trim()) {
      throw new AppError('Every team member needs a name, role and phone.');
    }
    requireMobile(member.phone, 'Team member phone');
  }

  const nextReg = input.registration.trim().toUpperCase();
  const regChanged = nextReg !== vehicle.registration;
  const typeChanged = input.vehicleType !== vehicle.vehicleType;
  const remark = input.changeRemark?.trim() || '';
  if ((regChanged || typeChanged) && !remark) {
    throw new AppError(
      'Record a remark when changing the vehicle number or type (for example a breakdown or replacement).',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTeamMember.deleteMany({ where: { vehicleId } });
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        registration: nextReg,
        vehicleType: input.vehicleType,
        logisticsPartner: input.logisticsPartner ?? null,
        driverName: input.driverName.trim(),
        driverPhone,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        changeRemark: remark || vehicle.changeRemark,
        team: {
          create: extraTeam.map((m) => ({
            name: m.name.trim(),
            role: m.role.trim(),
            phone: requireMobile(m.phone, 'Team member phone'),
          })),
        },
      },
    });
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'veh.update',
    entity: 'vehicle',
    entityId: vehicleId,
    details: {
      submissionId: sub.id,
      from: { reg: vehicle.registration, type: vehicle.vehicleType },
      to: { reg: nextReg, type: input.vehicleType },
      remark: remark || null,
    },
  });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { submission: withDerivedStages(refreshed) };
}

function requireMobile(raw: string, label: string): string {
  if (!isValidNational10(raw)) {
    throw new AppError(`${label} must be a 10-digit mobile number.`);
  }
  return formatE164(national10(raw), countryCodeOf(raw));
}
