import { formatMrnNumber, getFY } from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import type { SessionUser } from '../lib/auth-context.js';

export async function allocateMrnNumber(
  factoryId: string,
  receivedAt: Date,
  actor: SessionUser,
) {
  const fy = getFY(receivedAt);
  if (!fy) throw new Error('Invalid receipt date for MRN numbering.');

  return prisma.$transaction(async (tx) => {
    const counter = await tx.mrnCounter.upsert({
      where: { factoryId_fy: { factoryId, fy: fy.short } },
      create: { factoryId, fy: fy.short, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });

    const mrnNo = formatMrnNumber(factoryId, fy.short, counter.lastValue);

    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'mrn.seq.allocate',
      entity: 'mrn_counter',
      entityId: `${factoryId}/${fy.short}`,
      details: { sequence: counter.lastValue, mrnNo },
    });

    return { mrnNo, sequence: counter.lastValue, fy: fy.short };
  });
}
