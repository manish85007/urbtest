import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface AuditEntry {
  actorEmail: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export interface AuditListFilters {
  q?: string;
  actor?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'actor' | 'action';
  page?: number;
  limit?: number;
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

export async function listAudit(filters: AuditListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(1, filters.limit ?? 100), 5000);
  const sort = filters.sort ?? 'newest';
  const q = filters.q?.trim();

  const where: Prisma.AuditLogWhereInput = {};
  if (filters.actor) where.actorEmail = filters.actor;
  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;
  if (filters.from || filters.to) {
    where.ts = {};
    if (filters.from) where.ts.gte = new Date(`${filters.from}T00:00:00`);
    if (filters.to) where.ts.lte = new Date(`${filters.to}T23:59:59.999`);
  }
  if (q) {
    const detailIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM audit_log
      WHERE CAST(details AS TEXT) ILIKE ${'%' + q + '%'}
      LIMIT 4000
    `;
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { actorEmail: { contains: q, mode: 'insensitive' } },
      { entity: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
      ...(detailIds.length ? [{ id: { in: detailIds.map((r) => r.id) } }] : []),
    ];
  }

  const orderBy: Prisma.AuditLogOrderByWithRelationInput =
    sort === 'oldest'
      ? { ts: 'asc' }
      : sort === 'actor'
        ? { actorEmail: 'asc' }
        : sort === 'action'
          ? { action: 'asc' }
          : { ts: 'desc' };

  const [total, filtered, rows, actorRows, actionRows, entityRows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      distinct: ['actorEmail'],
      select: { actorEmail: true },
      orderBy: { actorEmail: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    }),
  ]);

  const actorUsers = actorRows.length
    ? await prisma.user.findMany({
        where: { email: { in: actorRows.map((a) => a.actorEmail) } },
        select: { email: true, name: true },
      })
    : [];
  const nameByEmail = new Map(actorUsers.map((u) => [u.email, u.name]));

  const pages = Math.max(1, Math.ceil(filtered / limit));

  return {
    total,
    filtered,
    page: Math.min(page, pages),
    pages,
    limit,
    rows: rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      actorEmail: r.actorEmail,
      actorName: r.actor?.name ?? nameByEmail.get(r.actorEmail) ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: r.details,
    })),
    actors: actorRows.map((a) => ({
      email: a.actorEmail,
      name: nameByEmail.get(a.actorEmail) ?? a.actorEmail,
    })),
    actions: actionRows.map((a) => a.action),
    entities: entityRows.map((e) => e.entity),
  };
}
