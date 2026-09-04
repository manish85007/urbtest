import { hasPermission, isValidNational10, national10, formatE164, countryCodeOf, lifecycleDateError } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { roundKg, toKg } from '../lib/decimal.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { loadSubmissionForActor, requirePermission } from '../lib/access.js';
import { withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';
import { notifyClient } from './submission-notify.js';

/** Calendar day in Asia/Kolkata for ISO timestamps; plain YYYY-MM-DD kept as-is. */
function calendarDayOf(raw: string): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    return s.slice(0, 10);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function assertVehicleScheduleDate(actor: SessionUser, expectedAt?: string) {
  if (!expectedAt?.trim()) return;
  const day = calendarDayOf(expectedAt);
  const err = lifecycleDateError(day, 'Expected pickup date', {
    allowHistoricalBackdate: hasPermission(actor.role, 'backdateRequests'),
    allowFuture: true,
    allowPastWithoutBackdate: false,
  });
  if (err) throw new AppError(err);
}

function assertWeighmentDate(actor: SessionUser, weighedAt: string) {
  const day = calendarDayOf(weighedAt);
  const err = lifecycleDateError(day, 'Weighment date', {
    allowHistoricalBackdate: hasPermission(actor.role, 'backdateRequests'),
    allowFuture: false,
    allowPastWithoutBackdate: false,
  });
  if (err) throw new AppError(err);
}

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

function totalNetKg(vehicles: Awaited<ReturnType<typeof loadSubmissionForActor>>['vehicles']) {
  return roundKg(vehicles.reduce((sum, v) => sum + Number(v.weighment?.netKg ?? 0), 0));
}

function assertReadyForLoadingComplete(
  vehicles: Awaited<ReturnType<typeof loadSubmissionForActor>>['vehicles'],
) {
  if (!vehicles.length) {
    throw new AppError('Assign at least one vehicle before acknowledging loading.');
  }
  for (const vehicle of vehicles) {
    const w = vehicle.weighment;
    if (!w) {
      throw new AppError(`Vehicle ${vehicle.registration} still needs a weighment.`);
    }
    if (w.manual) {
      if (!w.pickupPhotoIds?.length) {
        throw new AppError(`Pickup photos are required for ${vehicle.registration}.`);
      }
      continue;
    }
    if (!w.slipPhotoIds?.length) {
      throw new AppError(`Upload the weighment slip for ${vehicle.registration}.`);
    }
  }
}

/** Adding/changing fleet after loading ack invalidates the gate until ops re-acknowledges. */
async function clearLoadingCompleteIfSet(submissionId: string, previouslySet: boolean) {
  if (!previouslySet) return;
  await prisma.submission.update({
    where: { id: submissionId },
    data: { loadingCompletedAt: null, loadingCompletedBy: null },
  });
}

export async function addVehicle(
  actor: SessionUser,
  submissionId: string,
  input: AddVehicleInput,
) {
  requirePermission(actor, 'manageVehicles');
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (!sub.acknowledgedAt) {
    throw new AppError('Acknowledge the request before assigning vehicles.');
  }
  if (sub.closedAt) {
    throw new AppError('This request is closed — vehicles can no longer be assigned.');
  }
  assertVehicleScheduleDate(actor, input.expectedAt);

  const driverPhone = requireMobile(input.driverPhone, 'Driver phone');
  const registration = requireRegistration(input.registration);

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
      registration,
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

  await clearLoadingCompleteIfSet(submissionId, !!sub.loadingCompletedAt);

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'veh.add',
    entity: 'vehicle',
    entityId: vehicle.id,
    details: {
      submissionId,
      reg: vehicle.registration,
      team: vehicle.team.length,
      clearedLoadingComplete: !!sub.loadingCompletedAt,
    },
  });

  const refreshed = await loadSubmissionForActor(submissionId, actor);

  await notifyClient(refreshed, 'vehicle_assigned', {
    expected_date: input.expectedAt
      ? new Date(input.expectedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '(TBD)',
    registration,
    driver_name: input.driverName.trim(),
    driver_phone: input.driverPhone,
  });

  return { vehicle, submission: withDerivedStages(refreshed) };
}

export async function recordWeighment(
  actor: SessionUser,
  vehicleId: string,
  input: WeighmentInput,
) {
  requirePermission(actor, 'manageVehicles');
  assertWeighmentDate(actor, input.weighedAt);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { submission: true, weighment: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);

  let data;
  if (input.manual) {
    const net = toKg(input.net);
    if (!(net > 0)) throw new AppError('Net weight cannot be zero or negative. Enter a positive recorded weight.');
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
    const net = roundKg(gross - tare);
    if (!(net > 0)) {
      throw new AppError('Net weight cannot be zero or negative. Check gross and tare, then try again.');
    }
    if (!input.slipNumber?.trim()) throw new AppError('Weighment slip number is required.');

    data = {
      manual: false,
      grossKg: roundKg(gross),
      tareKg: roundKg(tare),
      netKg: net,
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

  // Editing an existing weighment after loading ack means slips/weights may have changed.
  if (vehicle.weighment && sub.loadingCompletedAt) {
    await clearLoadingCompleteIfSet(sub.id, true);
  }

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { weighment, submission: withDerivedStages(refreshed) };
}

export async function completeLoading(actor: SessionUser, submissionId: string) {
  requirePermission(actor, 'manageVehicles');
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed — loading cannot be acknowledged.');
  }
  if (sub.loadingCompletedAt) {
    throw new AppError('Loading has already been acknowledged for this request.');
  }
  assertReadyForLoadingComplete(sub.vehicles);

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      loadingCompletedAt: new Date(),
      loadingCompletedBy: actor.email,
    },
    include: submissionInclude,
  });

  await notifyClient(updated, 'loading_complete', {
    net_weight: totalNetKg(updated.vehicles),
    vehicle_count: updated.vehicles.length,
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sub.loading_complete',
    entity: 'submission',
    entityId: submissionId,
    details: { netKg: totalNetKg(updated.vehicles), vehicles: updated.vehicles.length },
  });

  return withDerivedStages(updated);
}

export async function updateVehicle(
  actor: SessionUser,
  vehicleId: string,
  input: AddVehicleInput,
) {
  requirePermission(actor, 'manageVehicles');

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { submission: true, team: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed — vehicle details can no longer be changed.');
  }
  assertVehicleScheduleDate(actor, input.expectedAt);

  const driverPhone = requireMobile(input.driverPhone, 'Driver phone');
  const extraTeam = (input.team ?? []).filter((m) => m.name?.trim() && m.phone?.trim());
  for (const member of extraTeam) {
    if (!member.role?.trim()) {
      throw new AppError('Every team member needs a name, role and phone.');
    }
    requireMobile(member.phone, 'Team member phone');
  }

  const nextReg = requireRegistration(input.registration);
  const prevReg = requireRegistration(vehicle.registration);
  const regChanged = nextReg !== prevReg;
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

export async function deleteVehicle(actor: SessionUser, vehicleId: string) {
  requirePermission(actor, 'manageVehicles');

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { submission: { include: { invoices: true } }, weighment: true, team: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const sub = await loadSubmissionForActor(vehicle.submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed — vehicles can no longer be removed.');
  }
  const billed = sub.invoices.some((inv) => inv.vehicleIds.includes(vehicleId));
  if (billed) {
    throw new AppError('This vehicle is on an invoice and cannot be deleted.');
  }

  await prisma.vehicle.delete({ where: { id: vehicleId } });
  await clearLoadingCompleteIfSet(sub.id, !!sub.loadingCompletedAt);
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'veh.delete',
    entity: 'vehicle',
    entityId: vehicleId,
    details: {
      submissionId: sub.id,
      registration: vehicle.registration,
      clearedLoadingComplete: !!sub.loadingCompletedAt,
    },
  });

  const refreshed = await loadSubmissionForActor(sub.id, actor);
  return { submission: withDerivedStages(refreshed) };
}

function requireRegistration(raw: string): string {
  const next = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!next) {
    throw new AppError('Vehicle registration can only contain letters and numbers — no spaces or special characters.');
  }
  return next;
}

function requireMobile(raw: string, label: string): string {
  if (!isValidNational10(raw)) {
    throw new AppError(`${label} must be a 10-digit mobile number.`);
  }
  return formatE164(national10(raw), countryCodeOf(raw));
}
