import {
  ACCESS_REVIEW_DAYS,
  APP_VERSION,
  DATA_CLASSES,
  DSR_DUE_DAYS,
  FILE_CLASS,
  RETENTION_YEARS,
  SOD_RULES,
  mfaRequired,
  pwExpired,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog, verifyChain } from './audit.js';
import { notifyAdmins } from './notifications.js';

const ORG = 'Urbeno Private Limited';

async function privacyVersion(): Promise<string> {
  const doc = await prisma.legalDocument.findUnique({ where: { key: 'privacy' } });
  return doc?.version ?? '1.0';
}

function padRef(prefix: string, n: number, width: number) {
  return `${prefix}${String(n).padStart(width, '0')}`;
}

export async function consentOf(email: string) {
  return prisma.consentRecord.findFirst({
    where: { email: email.toLowerCase() },
    orderBy: { at: 'desc' },
  });
}

export async function needsConsent(email: string, role?: string) {
  const version = await privacyVersion();
  const c = await consentOf(email);
  if (!c || c.withdrawn) return true;
  return c.version !== version;
}

export async function recordConsent(actor: SessionUser, version?: string, ip?: string) {
  const ver = version || (await privacyVersion());
  const rec = await prisma.consentRecord.create({
    data: {
      userId: actor.id,
      email: actor.email,
      version: ver,
      ip: ip ?? 'recorded server-side',
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'consent.record',
    entity: 'user',
    entityId: actor.email,
    details: { version: ver },
  });
  return rec;
}

export async function withdrawConsent(actor: SessionUser, email: string, reason: string) {
  const rec = await prisma.consentRecord.create({
    data: {
      email: email.toLowerCase(),
      version: await privacyVersion(),
      withdrawn: true,
      reason,
      userId: actor.id,
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'consent.withdraw',
    entity: 'user',
    entityId: email,
    details: { reason },
  });
  return rec;
}

export async function raiseDSR(
  actor: SessionUser,
  input: { kind: string; subject: string; cid?: string; note?: string },
) {
  const count = await prisma.dsrRequest.count();
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + DSR_DUE_DAYS);
  const rec = await prisma.dsrRequest.create({
    data: {
      ref: padRef('DSR-', count + 1, 4),
      kind: input.kind,
      subject: input.subject.trim(),
      clientId: input.cid || null,
      raisedBy: actor.email,
      due,
      note: input.note || '',
      status: 'open',
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'dsr.raise',
    entity: 'dsr',
    entityId: rec.ref,
    details: { kind: rec.kind, subject: rec.subject },
  });
  await notifyAdmins(
    'dsr',
    `Data subject request ${rec.ref} raised — due ${rec.due.toISOString().slice(0, 10)}`,
    '/compliance?tab=privacy',
  );
  return rec;
}

export async function closeDSR(actor: SessionUser, id: string, outcome: string) {
  const r = await prisma.dsrRequest.findUnique({ where: { id } });
  if (!r) throw new AppError('Request not found');
  if (!outcome?.trim()) throw new AppError('Record what was done to answer this request.');
  const updated = await prisma.dsrRequest.update({
    where: { id },
    data: {
      status: 'closed',
      closedAt: new Date(),
      outcome: outcome.trim(),
      closedBy: actor.email,
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'dsr.close',
    entity: 'dsr',
    entityId: r.ref,
    details: { outcome: updated.outcome },
  });
  return updated;
}

export async function dsrOverdue() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return prisma.dsrRequest.findMany({
    where: { status: 'open', due: { lt: today } },
  });
}

export async function subjectData(emailRaw: string) {
  const em = String(emailRaw).trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { email: em } });
  const raised = await prisma.submission.findMany({
    where: { createdBy: em },
    select: { id: true, createdAt: true, siteId: true },
  });
  const closures = await prisma.invoice.findMany({
    where: { closedBy: em },
    select: { invoiceNo: true, closedAt: true, closeRating: true, submissionId: true },
  });
  const consents = await prisma.consentRecord.findMany({ where: { email: em }, orderBy: { at: 'asc' } });
  const audits = await prisma.auditLog.count({ where: { actorEmail: em } });
  const found = !!u || raised.length > 0 || closures.length > 0 || consents.length > 0 || audits > 0;
  const lastConsent = consents[consents.length - 1];
  const clientName = u?.clientId
    ? (await prisma.client.findUnique({ where: { id: u.clientId } }))?.name
    : null;
  const summary = {
    Account: u ? `${u.name} · ${u.role}${clientName ? ' · ' + clientName : ''}` : 'No account',
    Status: u ? (u.active ? 'Active' : 'Deactivated') : '—',
    'Last sign-in': u?.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : 'never',
    'Privacy notice accepted': lastConsent
      ? `version ${lastConsent.version} on ${lastConsent.at.toISOString().slice(0, 10)}`
      : 'not recorded',
    'Requests raised': raised.length,
    'Closures acknowledged': closures.length,
    'Audit entries attributed': audits,
    Retention: `Personal data ${RETENTION_YEARS.personal} years after the account closes; compliance records ${RETENTION_YEARS.compliance} years`,
  };
  return {
    found,
    summary,
    email: em,
    generatedAt: new Date().toISOString(),
    account: u
      ? {
          email: u.email,
          name: u.name,
          role: u.role,
          organisation: u.clientId,
          siteScope: u.siteIds,
          lastLogin: u.lastLoginAt?.toISOString() ?? null,
          created: u.createdAt.toISOString(),
        }
      : null,
    consents: consents.map((c) => ({
      version: c.version,
      at: c.at.toISOString(),
      withdrawn: c.withdrawn,
      reason: c.reason,
    })),
    requestsRaised: raised.map((s) => ({ id: s.id, date: s.createdAt.toISOString().slice(0, 10), site: s.siteId })),
    closuresMade: closures.map((i) => ({
      request: i.submissionId,
      invoice: i.invoiceNo,
      at: i.closedAt?.toISOString() ?? null,
      rating: i.closeRating,
    })),
    auditEntries: audits,
  };
}

export async function raiseIncident(
  actor: SessionUser,
  input: {
    title: string;
    severity: string;
    category?: string;
    detectedAt?: string;
    description?: string;
    summary?: string;
    affected?: string;
    reportable?: boolean;
  },
) {
  const count = await prisma.incident.count();
  const rec = await prisma.incident.create({
    data: {
      ref: padRef('INC-', count + 1, 4),
      title: input.title,
      severity: input.severity,
      category: input.category ?? null,
      detectedAt: input.detectedAt ? new Date(input.detectedAt) : new Date(),
      raisedBy: actor.email,
      description: input.description || input.summary || '',
      summary: input.summary || input.description || '',
      affected: input.affected || '',
      reportable: !!input.reportable,
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'incident.raise',
    entity: 'incident',
    entityId: rec.ref,
    details: { severity: rec.severity, category: rec.category },
  });
  await notifyAdmins(
    'incident',
    `${rec.severity === 'high' ? '🚨' : '⚠️'} Incident ${rec.ref} raised — ${rec.title}`,
    '/compliance?tab=incidents',
  );
  return rec;
}

export async function updateIncident(
  actor: SessionUser,
  id: string,
  patch: {
    title?: string;
    severity?: string;
    status?: string;
    description?: string;
    summary?: string;
    rootCause?: string;
    action?: string;
    reportable?: boolean;
    detectedAt?: string;
  },
) {
  const r = await prisma.incident.findUnique({ where: { id } });
  if (!r) throw new AppError('Incident not found');
  const next = {
    title: patch.title ?? r.title,
    severity: patch.severity ?? r.severity,
    status: patch.status ?? r.status,
    description: patch.description ?? r.description,
    summary: patch.summary ?? r.summary,
    rootCause: patch.rootCause ?? r.rootCause,
    action: patch.action ?? r.action,
    reportable: patch.reportable ?? r.reportable,
    detectedAt: patch.detectedAt ? new Date(patch.detectedAt) : r.detectedAt,
    closedAt: r.closedAt,
    closedBy: r.closedBy,
  };
  if (patch.status === 'closed') {
    if (!next.rootCause?.trim()) throw new AppError('Record the root cause before closing an incident.');
    if (!next.action?.trim()) throw new AppError('Record the corrective action before closing an incident.');
    next.closedAt = new Date();
    next.closedBy = actor.email;
  }
  const updated = await prisma.incident.update({ where: { id }, data: next });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'incident.update',
    entity: 'incident',
    entityId: r.ref,
    details: { before: { status: r.status }, after: patch },
  });
  return updated;
}

export async function lastReview() {
  return prisma.accessReview.findFirst({
    where: { status: 'closed' },
    orderBy: { closedAt: 'desc' },
    include: { lines: true },
  });
}

export async function reviewDue() {
  const last = await lastReview();
  if (!last?.closedAt) return true;
  return (Date.now() - last.closedAt.getTime()) / 86400000 > ACCESS_REVIEW_DAYS;
}

export async function reviewDueInDays() {
  const last = await lastReview();
  if (!last?.closedAt) return 0;
  return Math.max(
    0,
    ACCESS_REVIEW_DAYS - Math.floor((Date.now() - last.closedAt.getTime()) / 86400000),
  );
}

export async function openReview() {
  return prisma.accessReview.findFirst({
    where: { status: 'open' },
    include: { lines: { orderBy: { email: 'asc' } } },
  });
}

export async function startReview(actor: SessionUser) {
  if (await openReview()) {
    throw new AppError('A review is already open. Complete it before starting another.');
  }
  const count = await prisma.accessReview.count();
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { email: 'asc' } });
  const rec = await prisma.accessReview.create({
    data: {
      ref: padRef('AR-', count + 1, 3),
      startedBy: actor.email,
      status: 'open',
      lines: {
        create: users.map((u) => ({
          userId: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          clientId: u.clientId,
          siteIds: u.siteIds,
          factoryIds: u.factoryIds,
          lastLoginAt: u.lastLoginAt,
        })),
      },
    },
    include: { lines: true },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'review.start',
    entity: 'review',
    entityId: rec.ref,
    details: { accounts: rec.lines.length },
  });
  return rec;
}

export async function decideReview(
  actor: SessionUser,
  reviewId: string,
  email: string,
  decision: 'keep' | 'revoke',
  note?: string,
) {
  const r = await prisma.accessReview.findUnique({
    where: { id: reviewId },
    include: { lines: true },
  });
  if (!r) throw new AppError('Review not found');
  const line = r.lines.find((l) => l.email === email);
  if (!line) throw new AppError('Account not in this review');
  if (decision === 'revoke' && !note?.trim()) {
    throw new AppError('Record why this access is being withdrawn.');
  }
  const updated = await prisma.accessReviewLine.update({
    where: { id: line.id },
    data: {
      decision,
      note: note || '',
      decidedAt: new Date(),
      decidedBy: actor.email,
    },
  });
  if (decision === 'revoke') {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u && u.email !== actor.email) {
      await prisma.user.update({ where: { id: u.id }, data: { active: false } });
      await auditLog({
        actorEmail: actor.email,
        actorId: actor.id,
        action: 'user.deactivate',
        entity: 'user',
        entityId: email,
        details: { via: r.ref },
      });
    }
  }
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'review.decide',
    entity: 'review',
    entityId: r.ref,
    details: { account: email, decision, note },
  });
  return updated;
}

export async function closeReview(actor: SessionUser, reviewId: string) {
  const r = await prisma.accessReview.findUnique({
    where: { id: reviewId },
    include: { lines: true },
  });
  if (!r) throw new AppError('Review not found');
  const undecided = r.lines.filter((l) => !l.decision);
  if (undecided.length) {
    throw new AppError(
      `${undecided.length} account${undecided.length > 1 ? 's have' : ' has'} no decision yet. Every account must be confirmed or withdrawn.`,
    );
  }
  const updated = await prisma.accessReview.update({
    where: { id: reviewId },
    data: { status: 'closed', closedAt: new Date(), closedBy: actor.email },
    include: { lines: true },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'review.close',
    entity: 'review',
    entityId: r.ref,
    details: {
      confirmed: r.lines.filter((l) => l.decision === 'keep').length,
      revoked: r.lines.filter((l) => l.decision === 'revoke').length,
    },
  });
  return updated;
}

export async function listReviews() {
  return prisma.accessReview.findMany({
    orderBy: { startedAt: 'desc' },
    include: { lines: true },
  });
}

export async function retentionRegister() {
  const y = RETENTION_YEARS;
  const age = (d: Date | null | undefined) =>
    d ? (Date.now() - d.getTime()) / (365.25 * 86400000) : 0;
  const rows: Array<{
    cls: string;
    kind: string;
    ref: string;
    held: string | null;
    keep: number;
    years: number;
    dueFrom: string | null;
    due: boolean;
    ctx: string;
  }> = [];
  const push = (
    cls: string,
    kind: string,
    ref: string,
    held: Date | null | undefined,
    keep: number,
    ctx: string,
  ) => {
    rows.push({
      cls,
      kind,
      ref,
      held: held ? held.toISOString() : null,
      keep,
      years: +age(held).toFixed(2),
      dueFrom: held
        ? new Date(held.getTime() + keep * 365.25 * 86400000).toISOString().slice(0, 10)
        : null,
      due: age(held) > keep,
      ctx,
    });
  };

  const invoices = await prisma.invoice.findMany({
    include: { mrn: true, recycling: { include: { serials: true } }, certificates: true },
  });
  for (const inv of invoices) {
    if (inv.mrn) push('confidential', 'MRN', inv.mrn.mrnNo, inv.mrn.receivedAt, y.compliance, inv.submissionId);
    if (inv.recycling) {
      push(
        'confidential',
        'Form 6 manifest',
        inv.recycling.form6No ?? inv.invoiceNo,
        inv.recycling.processedAt,
        y.compliance,
        inv.submissionId,
      );
      if (inv.recycling.serials.length) {
        push(
          'restricted',
          'Device serial records',
          `${inv.invoiceNo} · ${inv.recycling.serials.length} devices`,
          inv.recycling.processedAt,
          y.compliance,
          inv.submissionId,
        );
      }
    }
    for (const c of inv.certificates) {
      push('confidential', 'Certificate of destruction', c.certNo, c.certDate, y.certificate, inv.submissionId);
    }
  }

  const firstAudit = await prisma.auditLog.findFirst({ orderBy: { ts: 'asc' } });
  const auditCount = await prisma.auditLog.count();
  push('internal', 'Audit log', `${auditCount} entries`, firstAudit?.ts, y.audit, 'system');

  const firstConsent = await prisma.consentRecord.findFirst({ orderBy: { at: 'asc' } });
  const consentCount = await prisma.consentRecord.count();
  push('restricted', 'Consent records', `${consentCount} records`, firstConsent?.at, y.personal, 'system');

  return rows.sort((a, b) => Number(b.due) - Number(a.due) || String(a.dueFrom).localeCompare(String(b.dueFrom)));
}

export async function recordDisposal(
  actor: SessionUser,
  input: { kind: string; describes: string; method: string; approvedBy?: string; note?: string },
) {
  const count = await prisma.disposalRecord.count();
  const rec = await prisma.disposalRecord.create({
    data: {
      ref: padRef('DIS-', count + 1, 4),
      kind: input.kind,
      describes: input.describes,
      method: input.method,
      by: actor.email,
      approvedBy: input.approvedBy || '',
      note: input.note || '',
    },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'retention.dispose',
    entity: 'retention',
    entityId: rec.ref,
    details: { kind: rec.kind, method: rec.method },
  });
  return rec;
}

export function sodCheck(
  action: string,
  ctx: { invCreatedBy?: string | null; categoryEditedBy?: string | null; recyBy?: string | null },
  actorEmail: string,
): string[] {
  const conflicts: string[] = [];
  if (action === 'force-close' && ctx.invCreatedBy === actorEmail) {
    conflicts.push("You raised this invoice and are now force-closing it on the client's behalf.");
  }
  if (action === 'capacity-override' && ctx.categoryEditedBy === actorEmail) {
    conflicts.push("You last changed this category's authorised capacity and are now overriding it.");
  }
  if (action === 'cod-upload' && ctx.recyBy === actorEmail) {
    conflicts.push('You recorded the recycling and are now issuing the certificate for it.');
  }
  return conflicts;
}

export async function logSoD(
  actor: SessionUser,
  action: string,
  conflicts: string[],
  ref: string,
  justification?: string,
) {
  if (!conflicts.length) return null;
  const { recordSecurityEvent } = await import('./security-log.js');
  await recordSecurityEvent('sod', actor.email, { action, ref, conflicts }, 'warn');
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'sod.override',
    entity: 'control',
    entityId: ref,
    details: { action, conflicts, justification },
  });
  return true;
}

function st(ok: boolean, warn: boolean): 'ok' | 'warn' | 'fail' {
  return ok ? 'ok' : warn ? 'warn' : 'fail';
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

export async function controlStatus() {
  const chain = await verifyChain();
  const staff = await prisma.user.findMany({
    where: { active: true, role: { in: ['admin', 'operations', 'factory'] } },
  });
  const mfaOn = staff.filter((u) => u.mfaMethod === 'email' || !!u.mfaSecret).length;
  const users = await prisma.user.findMany({ where: { active: true } });
  const stale = users.filter((u) => pwExpired(u.passwordSetAt));
  const version = await privacyVersion();
  const clientUsers = users.filter((u) => u.role === 'client');
  const noConsent: typeof clientUsers = [];
  for (const u of clientUsers) {
    if (await needsConsent(u.email, u.role)) noConsent.push(u);
  }
  const ret = (await retentionRegister()).filter((r) => r.due);
  const openInc = await prisma.incident.findMany({ where: { status: { not: 'closed' } } });
  const incidents = await prisma.incident.count();
  const od = await dsrOverdue();
  const openDsrs = await prisma.dsrRequest.count({ where: { status: 'open' } });
  const last = await lastReview();
  const due = await reviewDue();
  const dueIn = await reviewDueInDays();

  return [
    {
      ref: 'CC7.2 / A.8.15',
      nm: 'Audit log integrity',
      state: chain.ok ? 'ok' : 'fail',
      detail: chain.ok
        ? `${chain.count} entries, chain intact`
        : `Chain broken at entry ${'seq' in chain ? chain.seq : '?'} — ${'reason' in chain ? chain.reason : ''}`,
      act: chain.ok ? null : 'Investigate immediately',
    },
    {
      ref: 'CC6.1 / A.5.17',
      nm: 'Multi-factor on privileged accounts',
      state: st(mfaOn === staff.length && staff.length > 0, mfaOn > 0),
      detail: `${mfaOn} of ${staff.length} staff accounts enrolled`,
      act: mfaOn < staff.length ? 'Enrol the remaining accounts' : null,
    },
    {
      ref: 'CC6.1 / A.5.17',
      nm: 'Password age',
      state: st(stale.length === 0, stale.length < 3),
      detail: stale.length
        ? `${stale.length} account${stale.length > 1 ? 's' : ''} past the rotation period`
        : 'All within policy',
      act: stale.length ? 'Require a reset on those accounts' : null,
    },
    {
      ref: 'CC6.2 / A.5.18',
      nm: 'Access recertification',
      state: due ? 'warn' : 'ok',
      detail: last?.closedAt
        ? `Last completed ${fmtDate(last.closedAt)}${due ? '' : ` · next due in ${dueIn} days`}`
        : 'Never performed',
      act: due ? 'Start a review' : null,
    },
    {
      ref: 'A.5.34 / DPDPA',
      nm: 'Privacy notice acceptance',
      state: st(noConsent.length === 0, true),
      detail: noConsent.length
        ? `${noConsent.length} client user${noConsent.length > 1 ? 's have' : ' has'} not accepted version ${version}`
        : `All current on version ${version}`,
      act: noConsent.length ? 'They are prompted at next sign-in' : null,
    },
    {
      ref: 'DPDPA',
      nm: 'Data subject requests',
      state: st(od.length === 0, true),
      detail: od.length
        ? `${od.length} past the ${DSR_DUE_DAYS}-day deadline`
        : `${openDsrs} open, none overdue`,
      act: od.length ? 'Answer them now' : null,
    },
    {
      ref: 'A.5.24–A.5.28',
      nm: 'Incident register',
      state: st(openInc.length === 0, true),
      detail: openInc.length ? `${openInc.length} open` : `${incidents} recorded, all closed`,
      act: openInc.length ? 'Progress to containment and closure' : null,
    },
    {
      ref: 'A.5.33 / Rule 12(4)',
      nm: 'Retention and disposal',
      state: st(ret.length === 0, true),
      detail: ret.length
        ? `${ret.length} record set${ret.length > 1 ? 's' : ''} past its retention date`
        : 'Nothing past its date',
      act: ret.length ? 'Review and record disposal' : null,
    },
    {
      ref: 'A.5.12',
      nm: 'Information classification',
      state: 'ok',
      detail: `${Object.keys(FILE_CLASS).length} document types classified`,
      act: null,
    },
    {
      ref: 'CC6.7 / A.8.13',
      nm: 'Backup and export',
      state: process.env.BACKUP_AUTOMATED === 'true' ? 'ok' : 'warn',
      detail:
        process.env.BACKUP_AUTOMATED === 'true'
          ? 'Automated database backups configured at the hosting layer'
          : 'Manual export only — automated backup is a production hosting control',
      act: process.env.BACKUP_AUTOMATED === 'true' ? null : 'Export regularly; automated in production',
    },
  ];
}

export async function evidencePack(actor: SessionUser) {
  const chain = await verifyChain();
  const [
    controls,
    auditEntries,
    securityEvents,
    users,
    activeUsers,
    clients,
    requests,
    certificates,
    reviews,
    incidents,
    dsrs,
    disposals,
    consents,
    version,
  ] = await Promise.all([
    controlStatus(),
    prisma.auditLog.count(),
    prisma.securityEvent.count(),
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.client.count(),
    prisma.submission.count(),
    prisma.certificate.count(),
    listReviews(),
    prisma.incident.findMany({ orderBy: { raisedAt: 'desc' } }),
    prisma.dsrRequest.findMany({ orderBy: { raisedAt: 'desc' } }),
    prisma.disposalRecord.findMany({ orderBy: { at: 'desc' } }),
    prisma.consentRecord.findMany(),
    privacyVersion(),
  ]);
  const pack = {
    generatedAt: new Date().toISOString(),
    generatedBy: actor.email,
    scope: { product: 'Urb TecTrack', version: APP_VERSION, organisation: ORG },
    controls,
    auditChain: chain,
    counts: {
      auditEntries,
      securityEvents,
      users,
      activeUsers,
      clients,
      requests,
      certificates,
    },
    accessReviews: reviews.map((r) => ({
      ref: r.ref,
      startedAt: r.startedAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      status: r.status,
      accounts: r.lines.length,
      confirmed: r.lines.filter((l) => l.decision === 'keep').length,
      revoked: r.lines.filter((l) => l.decision === 'revoke').length,
    })),
    incidents: incidents.map((i) => ({
      ref: i.ref,
      title: i.title,
      severity: i.severity,
      detectedAt: i.detectedAt.toISOString().slice(0, 10),
      status: i.status,
      closedAt: i.closedAt?.toISOString() ?? null,
      reportable: i.reportable,
    })),
    dsrs: dsrs.map((d) => ({
      ref: d.ref,
      kind: d.kind,
      raisedAt: d.raisedAt.toISOString(),
      due: d.due.toISOString().slice(0, 10),
      status: d.status,
      closedAt: d.closedAt?.toISOString() ?? null,
    })),
    disposals,
    consents: {
      version,
      accepted: consents.filter((c) => !c.withdrawn).length,
      withdrawn: consents.filter((c) => c.withdrawn).length,
    },
    retentionExceptions: (await retentionRegister()).filter((r) => r.due),
  };
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'evidence.export',
    entity: 'compliance',
    entityId: 'pack',
  });
  return pack;
}

export async function listIncidents() {
  return prisma.incident.findMany({ orderBy: { raisedAt: 'desc' } });
}

export async function listDsrs() {
  return prisma.dsrRequest.findMany({ orderBy: { raisedAt: 'desc' } });
}

export async function listDisposals() {
  return prisma.disposalRecord.findMany({ orderBy: { at: 'desc' } });
}

export async function consentStats() {
  const version = await privacyVersion();
  const clients = await prisma.user.findMany({ where: { role: 'client', active: true } });
  let accepted = 0;
  for (const u of clients) {
    if (!(await needsConsent(u.email))) accepted += 1;
  }
  const open = await prisma.dsrRequest.count({ where: { status: 'open' } });
  return {
    version,
    accepted,
    notAccepted: clients.length - accepted,
    openRequests: open,
    classes: DATA_CLASSES,
    fileClass: FILE_CLASS,
    retentionYears: RETENTION_YEARS,
    sodRules: SOD_RULES,
    mfaRoles: ['admin', 'factory'],
  };
}

export { mfaRequired, FILE_CLASS };
