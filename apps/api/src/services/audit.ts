import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface AuditEntry {
  actorEmail: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function auditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      actorEmail: entry.actorEmail,
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: (entry.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}
