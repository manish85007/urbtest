import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { nextSequence, submissionInclude } from '../lib/db-helpers.js';
import {
  loadSubmissionForActor,
  requireAdmin,
} from '../lib/access.js';
import { deriveSubmissionStage, withDerivedStages } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { sendTransactionalEmail } from './email.js';
import { assertFilesExist } from './file-service.js';
import { notifyAdmins, notifyClientUsers, notifyUsers } from './notifications.js';

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
  notes?: string;
  items?: SubmissionLineInput[];
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
  if (input.bomFileId) await assertFilesExist([input.bomFileId], ['bom']);
  const lines = linesForCreate(input.items, input.bomFileId, approxQty, approxWeight);

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
      bomFileId: input.bomFileId ?? null,
      notes: input.notes?.trim() || null,
      createdBy: actor.email,
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

  await sendTransactionalEmail('request_new_admin', [], {
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
  });

  return withDerivedStages(sub);
}

export async function acknowledgeSubmission(actor: SessionUser, submissionId: string) {
  requireAdmin(actor);
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

  await sendTransactionalEmail('request_ack', [updated.createdBy], {
    request_id: updated.id,
    request_date: updated.requestDate.toISOString().slice(0, 10),
    site_name: updated.site.name,
    location: updated.location,
    approx_weight: Number(updated.approxWeight),
    approx_qty: updated.approxQty,
    contact_name: updated.createdBy,
    client_name: updated.client.name,
  });

  await notifyUsers(
    [updated.createdBy],
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
    details: { emailed: updated.createdBy },
  });

  return withDerivedStages(updated);
}

export async function rejectSubmission(actor: SessionUser, submissionId: string, reason: string) {
  requireAdmin(actor);
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

  await sendTransactionalEmail('request_changes', [updated.createdBy], {
    request_id: updated.id,
    client_name: updated.client.name,
    site_name: updated.site.name,
    reason: reason.trim(),
    contact_name: updated.createdBy,
  });

  await notifyUsers(
    [updated.createdBy],
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
    requireAdmin(actor);
  } else if (actor.role === 'client') {
    if (stage !== 1) {
      throw new AppError('Only a new request can be edited.');
    }
    if (actor.clientId !== sub.clientId) {
      throw new AppError('You can only edit your own requests.');
    }
    if (!sub.rejectNote) {
      throw new AppError('This request has not been sent back for changes.');
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

  if (input.bomFileId) await assertFilesExist([input.bomFileId], ['bom']);
  const nextItems = input.items ? namedLines(input.items) : null;
  if (nextItems && !nextItems.length) {
    throw new AppError('Keep at least one line item.');
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
      `Request ${updated.id} updated by client after changes were requested`,
      updated.id,
    );
  }

  return withDerivedStages(updated);
}
