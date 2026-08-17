import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { auditHashPayload } from '../lib/audit-hash.js';

function newAuditId() {
  return 'c' + randomBytes(16).toString('hex').slice(0, 24);
}

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

export type ChainResult =
  | { ok: true; count: number; note: string; head?: undefined; from?: undefined; to?: undefined }
  | { ok: true; count: number; head: string; from: string; to: string; note?: undefined }
  | { ok: false; seq: number; reason: string };

function iso(d: Date): string {
  return d.toISOString();
}

export async function auditLog(entry: AuditEntry) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(87231001)`;
    const prev = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' } });
    const id = newAuditId();
    const ts = new Date();
    const seq = (prev?.seq ?? 0) + 1;
    const details = (entry.details ?? {}) as Record<string, unknown>;
    const prevHash = prev?.hash || 'GENESIS';
    const hash = auditHashPayload({
      seq,
      id,
      ts: iso(ts),
      actor: entry.actorEmail,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      details,
      prevHash,
    });
    return tx.auditLog.create({
      data: {
        id,
        seq,
        ts,
        actorEmail: entry.actorEmail,
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: details as Prisma.InputJsonValue,
        prevHash,
        hash,
      },
    });
  });
}

export async function verifyChain(): Promise<ChainResult> {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
  if (!rows.length) return { ok: true, count: 0, note: 'No entries yet' };
  let prevHash: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    if (!e.hash) return { ok: false, seq: e.seq ?? i, reason: 'entry carries no hash' };
    const computed = auditHashPayload({
      seq: e.seq,
      id: e.id,
      ts: iso(e.ts),
      actor: e.actorEmail,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      details: e.details,
      prevHash: e.prevHash,
    });
    if (computed !== e.hash) {
      return {
        ok: false,
        seq: e.seq ?? i,
        reason: 'contents do not match the recorded hash — the entry was altered',
      };
    }
    if (prevHash !== null && e.prevHash !== prevHash && e.prevHash !== 'ARCHIVED') {
      return {
        ok: false,
        seq: e.seq ?? i,
        reason: 'does not follow the previous entry — an entry was removed or reordered',
      };
    }
    prevHash = e.hash;
  }
  const last = rows[rows.length - 1];
  return {
    ok: true,
    count: rows.length,
    head: last.hash.slice(0, 16),
    from: iso(rows[0].ts),
    to: iso(last.ts),
  };
}

/** Recompute the entire chain from stored rows (used after schema backfill). */
export async function rebuildAuditChain() {
  const all = await prisma.auditLog.findMany({ orderBy: [{ seq: 'asc' }, { ts: 'asc' }, { id: 'asc' }] });
  let prevHash = 'GENESIS';
  let seq = 0;
  for (const row of all) {
    seq += 1;
    const hash = auditHashPayload({
      seq,
      id: row.id,
      ts: iso(row.ts),
      actor: row.actorEmail,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      details: row.details,
      prevHash,
    });
    if (row.seq !== seq || row.prevHash !== prevHash || row.hash !== hash) {
      await prisma.auditLog.update({
        where: { id: row.id },
        data: { seq, prevHash, hash },
      });
    }
    prevHash = hash;
  }
}

/** Fill seq/hash on rows created before the chain existed. */
export async function backfillAuditHashes() {
  await rebuildAuditChain();
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
      seq: r.seq,
      ts: r.ts.toISOString(),
      actorEmail: r.actorEmail,
      actorName: r.actor?.name ?? nameByEmail.get(r.actorEmail) ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: r.details,
      prevHash: r.prevHash,
      hash: r.hash,
    })),
    actors: actorRows.map((a) => ({
      email: a.actorEmail,
      name: nameByEmail.get(a.actorEmail) ?? a.actorEmail,
    })),
    actions: actionRows.map((a) => a.action),
    entities: entityRows.map((e) => e.entity),
  };
}
