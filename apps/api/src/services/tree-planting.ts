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
