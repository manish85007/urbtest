import type { SessionUser } from '../lib/auth-context.js';
import { isStaff } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { notifyAdmins, notifyClientUsers } from './notifications.js';

export type PlantingSource = 'urbeno' | 'client';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePlantingDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError('Planting date is required — CO₂ capture is measured from it.');
  }
  if (value > todayIso()) throw new AppError('Planting date cannot be in the future.');
  return new Date(`${value}T00:00:00.000Z`);
}

export async function recordTreePlanting(
  actor: SessionUser,
  input: {
    trees: number;
    plantedAt: string;
    location?: string;
    state?: string;
    partner?: string;
    species?: string;
    note?: string;
    photoFileId?: string;
    clientId?: string | null;
    source?: PlantingSource;
  },
) {
  if (input.trees < 1) throw new AppError('Enter how many trees were planted.');

  let clientId = input.clientId ?? null;
  if (actor.role === 'client') {
    clientId = actor.clientId;
  }
  if (!clientId) throw new AppError('Select the organisation this planting belongs to.');

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) throw new AppError('Select the organisation this planting belongs to.');

  const source: PlantingSource = actor.role === 'client' ? 'client' : input.source === 'client' ? 'client' : 'urbeno';
  const plantedAt = parsePlantingDate(input.plantedAt);
  const photoIds = input.photoFileId ? [input.photoFileId] : [];

  const row = await prisma.treePlanting.create({
    data: {
      clientId,
      trees: input.trees,
      plantedAt,
      location: input.location?.trim() || null,
      state: input.state?.trim() || null,
      partner: input.partner?.trim() || null,
      species: input.species?.trim() || null,
      source,
      photoIds,
      note: input.note?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'tree.plant',
    entity: 'tree_planting',
    entityId: row.id,
    details: { trees: row.trees, clientId, source, location: row.location },
  });

  if (source === 'urbeno') {
    await notifyClientUsers(
      clientId,
      'trees',
      `🌳 Urbeno planted ${row.trees} tree${row.trees > 1 ? 's' : ''} on your behalf at ${row.location || 'a partner site'}`,
      '/heroes',
    );
  } else {
    await notifyAdmins(
      'trees',
      `🌳 ${client.name} logged ${row.trees} tree${row.trees > 1 ? 's' : ''} from their own CSR drive`,
      '/heroes',
    );
  }

  return row;
}

export async function recordTreeProgress(
  actor: SessionUser,
  plantingId: string,
  input: { notedAt: string; photoFileId: string; note?: string },
) {
  const planting = await prisma.treePlanting.findUnique({ where: { id: plantingId } });
  if (!planting) throw new AppError('Planting not found.', 404);
  if (actor.role === 'client' && planting.clientId !== actor.clientId) {
    throw new AppError('You can only add photos to your own plantings.', 403);
  }
  if (!input.photoFileId) throw new AppError('Attach the photo.');
  if (!input.notedAt) throw new AppError('Photo date is required.');
  if (input.notedAt > todayIso()) throw new AppError('Photo date cannot be in the future.');
  const planted = planting.plantedAt.toISOString().slice(0, 10);
  if (input.notedAt < planted) {
    throw new AppError('The photo cannot pre-date the planting.');
  }

  const row = await prisma.treeProgress.create({
    data: {
      plantingId,
      notedAt: new Date(`${input.notedAt}T00:00:00.000Z`),
      photoFileId: input.photoFileId,
      note: input.note?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'tree.progress',
    entity: 'tree_planting',
    entityId: plantingId,
  });

  if (actor.role !== 'client' && planting.clientId) {
    await notifyClientUsers(
      planting.clientId,
      'trees',
      `📷 New growth photo added for the ${planting.trees} tree${planting.trees > 1 ? 's' : ''} planted at ${planting.location || 'your partner site'}`,
      '/heroes',
    );
  }

  return row;
}

export async function removeTreePlanting(actor: SessionUser, plantingId: string) {
  if (!isStaff(actor)) throw new AppError('Only Urbeno staff can remove planting records.', 403);
  const planting = await prisma.treePlanting.findUnique({ where: { id: plantingId } });
  if (!planting) throw new AppError('Planting not found.', 404);
  await prisma.treePlanting.delete({ where: { id: plantingId } });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'tree.remove',
    entity: 'tree_planting',
    entityId: plantingId,
    details: { trees: planting.trees, clientId: planting.clientId },
  });
  return { ok: true };
}

export async function removeTreeProgress(actor: SessionUser, plantingId: string, progressId: string) {
  if (!isStaff(actor)) throw new AppError('Only Urbeno staff can remove growth photos.', 403);
  const row = await prisma.treeProgress.findFirst({ where: { id: progressId, plantingId } });
  if (!row) throw new AppError('Growth photo not found.', 404);
  await prisma.treeProgress.delete({ where: { id: progressId } });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'tree.progress.remove',
    entity: 'tree_planting',
    entityId: plantingId,
    details: { progressId },
  });
  return { ok: true };
}
