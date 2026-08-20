import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { nextSequence, submissionInclude } from '../lib/db-helpers.js';
import {
  loadSubmissionForActor,
  requireAdmin,
  requirePermission,
} from '../lib/access.js';
import { deriveSubmissionStage, withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { assertFilesExist } from './file-service.js';
import { notifyAdmins, notifyClientUsers, notifyUsers } from './notifications.js';
import { notifyClient, notifyStaffNewRequest } from './submission-notify.js';
import { isPastCalendarDate } from '@urb-tectrack/shared';

const PLACEHOLDER_ITEM = 'Mixed e-waste (see attached BoM)';

export interface SubmissionLineInput {
  name: string;
  qty?: number;
  weightKg?: number;
  hsn?: string;
}

export interface CreateSubmissionInput {
  clientId: string;
  siteId: string;
  ref?: string;
  requestDate: string;
  location?: string;
  approxQty?: number;
  approxWeight?: number;
  bomFileId?: string;
  bomFileIds?: string[];
  notes?: string;
  items?: SubmissionLineInput[];
  onBehalfOf?: string;
}

function bomIdsFrom(input: { bomFileId?: string | null; bomFileIds?: string[] | null }) {
  const ids = [...(input.bomFileIds ?? []), ...(input.bomFileId ? [input.bomFileId] : [])]
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

function namedLines(items?: SubmissionLineInput[]) {
  return (items ?? [])
    .map((i) => ({
      name: i.name.trim(),
      qty: i.qty ?? 0,
      weightKg: i.weightKg ?? 0,
      hsn: i.hsn?.trim() || '854890',
    }))
    .filter((i) => i.name);
}

function linesForCreate(
  items: SubmissionLineInput[] | undefined,
  bomFileId: string | undefined,
  approxQty: number,
  approxWeight: number,
) {
  const named = namedLines(items);
  if (!named.length && !bomFileId) {
    throw new AppError('Add at least one line item, or attach a bill of materials.');
  }
  return named.length
    ? named
    : [{ name: PLACEHOLDER_ITEM, qty: approxQty, weightKg: approxWeight, hsn: '854890' }];
}

export async function createSubmission(actor: SessionUser, input: CreateSubmissionInput) {
  const clientId = input.clientId.trim().toUpperCase();
  if (actor.role === 'client') {
    if (actor.clientId !== clientId) {
      throw new AppError('You can only raise requests for your own organisation.');
    }
    if (actor.siteIds.length && !actor.siteIds.includes(input.siteId)) {
      throw new AppError('You do not have access to this site.');
    }
  } else {
    requirePermission(actor, 'createRequestAsStaff');
  }

  const site = await prisma.site.findFirst({
    where: { id: input.siteId, clientId, active: true },
  });
  if (!site) throw new AppError('Site not found for this client.');

  const client = await prisma.client.findUnique({ where: { id: clientId, active: true } });
  if (!client) throw new AppError('Client not found.');

  const location = input.location?.trim() || '';
  const approxQty = input.approxQty ?? 0;
  const approxWeight = input.approxWeight ?? 0;
  if (!location || !input.requestDate || !approxQty || !approxWeight) {
    throw new AppError('Site, location, date, approximate quantity and weight are all required.');
  }
  if (isPastCalendarDate(input.requestDate)) {
    throw new AppError('Pick-up request date cannot be in the past. Choose today or a future date.');
  }
  if (input.bomFileId || input.bomFileIds?.length) {
    await assertFilesExist(bomIdsFrom(input), ['bom']);
  }
  const bomIds = bomIdsFrom(input);
  const lines = linesForCreate(input.items, bomIds[0], approxQty, approxWeight);

  let onBehalfOf: string | null = null;
  if (actor.role !== 'client' && input.onBehalfOf?.trim()) {
    const email = input.onBehalfOf.trim().toLowerCase();
    const requestor = await prisma.user.findFirst({
      where: {
        email,
        clientId,
        role: 'client',
        active: true,
      },
      select: { email: true, siteIds: true },
    });
    if (!requestor) {
      throw new AppError('Selected requestor is not an active user for this client.');
    }
    if (requestor.siteIds.length && !requestor.siteIds.includes(site.id)) {
      throw new AppError('Selected requestor does not have access to this site.');
    }
    onBehalfOf = email;
  }

  const id = await nextSequence('sub');
  const sub = await prisma.submission.create({
    data: {
      id,
      clientId,
      siteId: site.id,
      ref: input.ref?.trim() || null,
      requestDate: new Date(input.requestDate),
      location,
      approxQty,
      approxWeight,
      bomFileId: bomIds[0] ?? null,
      bomFileIds: bomIds,
      notes: input.notes?.trim() || null,
      createdBy: actor.email,
      onBehalfOf,
      items: {
        create: lines.map((line, i) => ({
          name: line.name,
          qty: line.qty,
          weightKg: line.weightKg,
          hsn: line.hsn,
          sortOrder: i,
        })),
      },
    },
    include: submissionInclude,
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sub.create',
    entity: 'submission',
    entityId: sub.id,
    details: { clientId, siteId: site.id, approxWeight: input.approxWeight ?? 0 },
  });

  await notifyAdmins(
    'sub.new',
    `New request ${sub.id} from ${client.name} — ${input.approxWeight ?? 0} kg approx`,
    sub.id,
  );

  const staffVars = {
    request_id: sub.id,
    client_name: client.name,
    client_code: clientId,
    site_name: site.name,
    location: input.location || '—',
    request_date: input.requestDate,
    approx_weight: input.approxWeight ?? 0,
    approx_qty: input.approxQty ?? 0,
    raised_by: actor.name,
    raised_email: actor.email,
    site_contact: site.contactName ?? client.contact ?? '—',
    site_phone: site.contactPhone ?? client.phone ?? '—',
    notes: input.notes || '(none)',
  };

  await notifyStaffNewRequest(staffVars);
  await notifyClient(sub, 'request_new_client', {
    location: input.location || '—',
    request_date: input.requestDate,
    approx_weight: input.approxWeight ?? 0,
    approx_qty: input.approxQty ?? 0,
  });

  return withDerivedStages(sub);
}

export async function acknowledgeSubmission(actor: SessionUser, submissionId: string) {
  requirePermission(actor, 'acknowledgeRequest');
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (deriveSubmissionStage(sub) !== 1) {
    throw new AppError('Only a new request can be acknowledged.');
  }

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedBy: actor.email,
      rejectNote: null,
      rejectAt: null,
    },
    include: submissionInclude,
  });

  const contact = await notifyClient(updated, 'request_ack', {
    request_date: updated.requestDate.toISOString().slice(0, 10),
    location: updated.location,
    approx_weight: Number(updated.approxWeight),
    approx_qty: updated.approxQty,
  });

  await notifyUsers(
    [contact.email],
    'sub.ack',
    `Request ${updated.id} acknowledged by Urbeno — pickup will be scheduled`,
    updated.id,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sub.acknowledge',
    entity: 'submission',
    entityId: submissionId,
    details: { emailed: contact.email },
  });

  return withDerivedStages(updated);
}

export async function rejectSubmission(actor: SessionUser, submissionId: string, reason: string) {
  requirePermission(actor, 'rejectRequest');
  const sub = await loadSubmissionForActor(submissionId, actor);
  if (!reason?.trim()) throw new AppError('A rejection reason is required.');

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      rejectNote: reason.trim(),
      rejectAt: new Date(),
    },
    include: submissionInclude,
  });

  const contact = await notifyClient(updated, 'request_changes', {
    reason: reason.trim(),
  });

  await notifyUsers(
    [contact.email],
    'sub.reject',
    `Request ${updated.id} needs changes: ${reason.trim()}`,
    updated.id,
  );

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sub.reject',
    entity: 'submission',
    entityId: submissionId,
    details: { reason: reason.trim() },
  });

  return withDerivedStages(updated);
}

export interface UpdateSubmissionInput {
  location?: string;
  approxQty?: number;
  approxWeight?: number;
  notes?: string;
  ref?: string;
  bomFileId?: string | null;
  bomFileIds?: string[];
  items?: SubmissionLineInput[];
  siteId?: string;
  requestDate?: string;
}

export async function updateSubmission(
  actor: SessionUser,
  submissionId: string,
  input: UpdateSubmissionInput,
) {
  const sub = await loadSubmissionForActor(submissionId, actor);
  const stage = deriveSubmissionStage(sub);

  if (sub.closedAt) {
    throw new AppError('A closed request cannot be edited.');
  }
  if (actor.role === 'admin') {
    requirePermission(actor, 'editRequestAsStaff');
  } else if (actor.role === 'client') {
    if (stage !== 1) {
      throw new AppError('Only a new request can be edited.');
    }
    if (actor.clientId !== sub.clientId) {
      throw new AppError('You can only edit your own requests.');
    }
  } else {
    throw new AppError('You cannot edit this request.');
  }

  if (input.siteId && input.siteId !== sub.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: input.siteId, clientId: sub.clientId, active: true },
    });
    if (!site) throw new AppError('Site not found for this client.');
  }

  if (input.bomFileId || input.bomFileIds) {
    const bomIds = bomIdsFrom(input);
    if (bomIds.length) await assertFilesExist(bomIds, ['bom']);
    input = { ...input, bomFileId: bomIds[0] ?? null, bomFileIds: bomIds };
  }
  const nextItems = input.items ? namedLines(input.items) : null;
  if (nextItems && !nextItems.length) {
    throw new AppError('Keep at least one line item.');
  }
  if (input.requestDate) {
    const previous = sub.requestDate.toISOString().slice(0, 10);
    if (input.requestDate.slice(0, 10) !== previous && isPastCalendarDate(input.requestDate)) {
      throw new AppError('Pick-up request date cannot be in the past. Choose today or a future date.');
    }
  }

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      location: input.location !== undefined ? input.location.trim() || null : undefined,
      approxQty: input.approxQty,
      approxWeight: input.approxWeight,
      notes: input.notes !== undefined ? input.notes.trim() || null : undefined,
      ref: input.ref !== undefined ? input.ref.trim() || null : undefined,
      bomFileId: input.bomFileId !== undefined ? input.bomFileId : undefined,
      bomFileIds: input.bomFileIds !== undefined ? input.bomFileIds : undefined,
      siteId: input.siteId,
      requestDate: input.requestDate ? new Date(input.requestDate) : undefined,
      rejectNote: actor.role === 'client' ? null : undefined,
      rejectAt: actor.role === 'client' ? null : undefined,
      ...(nextItems
        ? {
            items: {
              deleteMany: {},
              create: nextItems.map((line, i) => ({
                name: line.name,
                qty: line.qty,
                weightKg: line.weightKg,
                hsn: line.hsn,
                sortOrder: i,
              })),
            },
          }
        : {}),
    },
    include: submissionInclude,
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sub.update',
    entity: 'submission',
    entityId: submissionId,
  });

  if (actor.role === 'client') {
    await notifyAdmins(
      'sub.resubmit',
      `Request ${updated.id} updated by client${sub.rejectNote ? ' after changes were requested' : ''}`,
      updated.id,
    );
  }

  return withDerivedStages(updated);
}
