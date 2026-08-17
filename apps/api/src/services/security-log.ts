import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notifyAdmins } from './notifications.js';

export type SecuritySeverity = 'high' | 'warn' | 'info';

export async function recordSecurityEvent(
  kind: string,
  email: string,
  detail: Record<string, unknown> = {},
  severity: SecuritySeverity = 'info',
  userAgent?: string,
) {
  const rec = await prisma.securityEvent.create({
    data: {
      kind,
      email,
      severity,
      detail: detail as Prisma.InputJsonValue,
      userAgent: userAgent ?? null,
    },
  });
  if (severity === 'high') {
    await notifyAdmins('security', `Security event: ${kind} — ${email}`, '/compliance?tab=security');
  }
  return rec;
}

export async function denyAccess(
  actorEmail: string,
  actorRole: string,
  what: string,
  ref: string,
  why: string,
) {
  await recordSecurityEvent(
    'access.denied',
    actorEmail,
    { what, ref, why, role: actorRole },
    'warn',
  );
  return false;
}

export async function listSecurityEvents(filters: {
  kind?: string;
  severity?: string;
  em?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}) {
  const where: Prisma.SecurityEventWhereInput = {};
  if (filters.kind) where.kind = filters.kind;
  if (filters.severity) where.severity = filters.severity;
  if (filters.em) where.email = filters.em;
  if (filters.from || filters.to) {
    where.ts = {};
    if (filters.from) where.ts.gte = new Date(`${filters.from}T00:00:00`);
    if (filters.to) where.ts.lte = new Date(`${filters.to}T23:59:59.999`);
  }
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { kind: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  const limit = Math.min(filters.limit ?? 200, 2000);
  const [rows, kinds] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
    }),
    prisma.securityEvent.findMany({
      distinct: ['kind'],
      select: { kind: true },
      orderBy: { kind: 'asc' },
    }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      kind: r.kind,
      email: r.email,
      severity: r.severity,
      detail: r.detail,
    })),
    kinds: kinds.map((k) => k.kind),
  };
}
