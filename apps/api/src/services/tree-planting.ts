import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';

export async function recordTreePlanting(
  actor: SessionUser,
  input: {
    trees: number;
    plantedAt: string;
    location?: string;
    note?: string;
    clientId?: string | null;
  },
) {
  if (input.trees < 1) throw new AppError('Tree count must be at least 1.');

  let clientId = input.clientId ?? null;
  if (actor.role === 'client') {
    clientId = actor.clientId;
  }
  if (!clientId && actor.role !== 'admin') {
    throw new AppError('Client is required for this planting record.');
  }

  const row = await prisma.treePlanting.create({
    data: {
      clientId,
      trees: input.trees,
      plantedAt: new Date(input.plantedAt),
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'tree.plant',
    entity: 'tree_planting',
    entityId: row.id,
    details: { trees: row.trees, clientId },
  });

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
  if (new Date(input.notedAt) < planting.plantedAt) {
    throw new AppError('The photo cannot pre-date the planting.');
  }

  const row = await prisma.treeProgress.create({
    data: {
      plantingId,
      notedAt: new Date(input.notedAt),
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

  return row;
}
