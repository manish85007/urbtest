import {
  SLA_LABEL,
  computeImpact,
  currentFY,
  dateInPeriod,
  getPayStatus,
  settledPaise,
  heroProgress,
  inFiscalYear,
  invStage,
  invoiceDue,
  parseReportPeriod,
  paymentTermsLabel,
  periodLabel,
  recyclingSla,
  sequestered,
  stageLabel,
  sumPaise,
  treesEarned,
  fiscalYearBounds,
  listFiscalYears,
  type ReportPeriod,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { clientScopeFilter, factoryInScope, hasFeature, isStaff } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude, type SubmissionFull } from '../lib/db-helpers.js';
import { deriveSubmissionStage } from '../lib/stage-mapper.js';
import { AppError } from '../lib/errors.js';
import { requireAdmin } from '../lib/access.js';
import { sendTransactionalEmail } from './email.js';

const SLA_RECYCLE_DAYS = Number(process.env.SLA_RECYCLE_DAYS ?? 30);
const SLA_WARN_AT = Number(process.env.SLA_WARN_AT ?? 0.8);

type InvoiceRow = Awaited<ReturnType<typeof loadInvoiceRows>>[number];

async function loadInvoiceRows(actor: SessionUser) {
  const scope = clientScopeFilter(actor);
  return prisma.invoice.findMany({
    where: {
      closedAt: null,
      submission: scope,
    },
    include: {
      payments: true,
      mrn: true,
      recycling: true,
      certificates: { orderBy: { uploadedAt: 'asc' }, take: 1 },
      submission: {
        include: {
          client: true,
          site: true,
          vehicles: { include: { weighment: true } },
        },
      },
    },
  });
}

function invoiceStage(inv: {
  closedAt: Date | null;
  certificates: unknown[];
  recycling: unknown | null;
  mrn: unknown | null;
}): number {
  return invStage({
    closedAt: inv.closedAt,
    hasCertificate: inv.certificates.length > 0,
    hasRecycling: !!inv.recycling,
    hasMrn: !!inv.mrn,
  });
}

function submissionNetKg(sub: SubmissionFull): number {
  return sub.vehicles.reduce((sum, v) => sum + Number(v.weighment?.netKg ?? 0), 0);
}

function factoryCanSee(actor: SessionUser, inv: InvoiceRow): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'factory') return false;
  if (!inv.mrn) return true;
  return factoryInScope(actor, inv.mrn.factoryId);
}

async function staffCapacitySummary(actor: SessionUser) {
  const factories = await prisma.factorySite.findMany({
    where: { active: true },
    select: { id: true },
  });
  const period = parseReportPeriod({ period: 'fy' });
  let authorized = 0;
  let processed = 0;
  for (const fac of factories.filter((f) => factoryInScope(actor, f.id))) {
    const row = await getCapacityReport(actor, fac.id, period);
    authorized += row.stats.authorized;
    processed += row.stats.processed;
  }
  return {
    pct: authorized > 0 ? (processed / authorized) * 100 : 0,
    capTpa: authorized / 1000,
  };
}

function mapActiveRequest(s: SubmissionFull) {
  return {
    id: s.id,
    clientName: s.client.name,
    siteName: s.site.name,
    requestDate: s.requestDate.toISOString().slice(0, 10),
    stage: deriveSubmissionStage(s),
    invoices: s.invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      stage: invoiceStage(inv),
    })),
    netKg: submissionNetKg(s),
    approxWeight: Number(s.approxWeight),
    ref: s.ref,
  };
}

export async function getStaffDashboard(actor: SessionUser) {
  const scope = clientScopeFilter(actor);
  const [allSubs, openInvoices, reminderLogs, capacity] = await Promise.all([
    prisma.submission.findMany({
      where: scope,
      include: submissionInclude,
      orderBy: { createdAt: 'desc' },
    }),
    loadInvoiceRows(actor),
    prisma.reminderLog.findMany({ where: { key: { startsWith: 'pay:' } } }),
    staffCapacitySummary(actor),
  ]);
  const submissions = allSubs.filter((s) => deriveSubmissionStage(s) < 9);

  const reminderByKey = new Map(reminderLogs.map((r) => [r.key, r.count]));

  // Only show genuinely-new requests (no rejectNote) in "Awaiting Acknowledgement".
  // Returned requests (rejectNote set) are pending with the requestor and must NOT
  // appear in the admin queue until the requestor resubmits (clears the rejectNote).
  const newRequests = submissions
    .filter((s) => deriveSubmissionStage(s) === 1 && !s.rejectNote)
    .map((s) => ({
      id: s.id,
      clientName: s.client.name,
      siteName: s.site.name,
      approxWeight: Number(s.approxWeight),
      approxQty: s.approxQty,
      requestDate: s.requestDate.toISOString().slice(0, 10),
      ref: s.ref,
    }));

  const overdue: Array<{
    submissionId: string;
    invoiceId: string;
    invoiceNo: string;
    clientName: string;
    paymentTerms: string;
    outstandingPaise: string;
    overdueDays: number;
    reminders: number;
  }> = [];

  for (const inv of openInvoices) {
    const paidPaise = settledPaise(inv.payments);
    const pay = getPayStatus(inv.totalPaise, paidPaise);
    if (pay.key === 'paid') continue;

    const due = invoiceDue(inv.invoiceDate, inv.submission.client.payTermsDays);
    if (!due.isOverdue) continue;

    overdue.push({
      submissionId: inv.submissionId,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      clientName: inv.submission.client.name,
      paymentTerms: paymentTermsLabel(inv.submission.client.payTermsDays),
      outstandingPaise: pay.duePaise.toString(),
      overdueDays: due.overdue,
      reminders: reminderByKey.get(`pay:${inv.id}`) ?? 0,
    });
  }
  overdue.sort((a, b) => b.overdueDays - a.overdueDays);

  const slaAtRisk: Array<{
    submissionId: string;
    invoiceId: string;
    invoiceNo: string;
    clientName: string;
    receivedDate: string;
    daysUsed: number;
    slaDays: number;
    state: string;
    stateLabel: string;
  }> = [];

  for (const inv of openInvoices) {
    if (!inv.mrn || !factoryCanSee(actor, inv)) continue;
    const sla = recyclingSla({
      mrnReceivedAt: inv.mrn.receivedAt,
      certificateAt: inv.certificates[0]?.uploadedAt ?? null,
      slaDays: SLA_RECYCLE_DAYS,
      warnAtPct: SLA_WARN_AT,
    });
    if (!sla || sla.done || sla.state === 'ok' || sla.state === 'met') continue;
    slaAtRisk.push({
      submissionId: inv.submissionId,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      clientName: inv.submission.client.name,
      receivedDate: inv.mrn.receivedAt.toISOString().slice(0, 10),
      daysUsed: sla.daysUsed,
      slaDays: sla.slaDays,
      state: sla.state,
      stateLabel: SLA_LABEL[sla.state],
    });
  }
  slaAtRisk.sort((a, b) => b.daysUsed - a.daysUsed);

  const queueItem = (inv: InvoiceRow) => ({
    submissionId: inv.submissionId,
    invoiceId: inv.id,
    invoiceNo: inv.invoiceNo,
    clientName: inv.submission.client.name,
  });

  const visibleInv = openInvoices.filter((inv) => factoryCanSee(actor, inv));

  const queues = {
    awaitingMrn: visibleInv.filter((inv) => invoiceStage(inv) === 5).map(queueItem),
    awaitingRecycling: visibleInv.filter((inv) => invoiceStage(inv) === 6).map(queueItem),
    awaitingCod:
      actor.role === 'admin'
        ? openInvoices.filter((inv) => invoiceStage(inv) === 7).map(queueItem)
        : [],
    awaitingClose: openInvoices.filter((inv) => invoiceStage(inv) === 8).map(queueItem),
  };

  const pendingPayments = openInvoices.filter((inv) => {
    const paid = settledPaise(inv.payments);
    return getPayStatus(inv.totalPaise, paid).key !== 'paid';
  }).length;

  const fy = currentFY();
  const fyLabel = fy?.label ?? '';
  const fyNetKg = allSubs
    .filter((s) => fyLabel && inFiscalYear(s.requestDate, fyLabel))
    .reduce((sum, s) => sum + submissionNetKg(s), 0);

  return {
    stats: {
      newRequests: newRequests.length,
      openRequests: submissions.length,
      totalRequests: allSubs.length,
      openInvoices: openInvoices.length,
      pendingPayments,
      fyNetKg,
      fyLabel,
      capacity,
    },
    newRequests,
    activeRequests: submissions.map(mapActiveRequest),
    overdue,
    slaAtRisk,
    queues,
  };
}

export async function getImpactReport(
  actor: SessionUser,
  siteId?: string,
  period?: ReportPeriod,
  clientId?: string,
) {
  const scopedClientId = actor.role === 'client' ? actor.clientId : clientId;
  const baseScope = scopedClientId ? { clientId: scopedClientId } : clientScopeFilter(actor);
  const scope = siteId ? { ...baseScope, siteId } : baseScope;
  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const fy = currentFY();
  const fyLabel = fy?.label ?? '';

  const where: Record<string, unknown> = {
    closedAt: { not: null },
    submission: scope,
  };

  const closedInvoices = await prisma.invoice.findMany({
    where,
    include: {
      submission: { include: { client: true, site: true } },
      certificates: true,
    },
  });

  const inPeriod = closedInvoices.filter(
    (inv) => inv.closedAt && dateInPeriod(inv.closedAt, resolved),
  );

  const kg = inPeriod.reduce((sum, inv) => sum + Number(inv.billingWeight), 0);
  const seenSubs = new Set(inPeriod.map((inv) => inv.submissionId));
  const impact = computeImpact(kg, inPeriod.length, seenSubs.size);

  const pendingClose = await prisma.invoice.findMany({
    where: {
      closedAt: null,
      submission: scope,
      certificates: { some: {} },
    },
    include: {
      submission: true,
      certificates: true,
      mrn: true,
      recycling: true,
    },
  });

  const pending = pendingClose
    .filter((inv) => invoiceStage(inv) === 8)
    .map((inv) => ({
      submissionId: inv.submissionId,
      invoiceNo: inv.invoiceNo,
      certificates: inv.certificates.map((c) => c.certNo),
      issuedAt: inv.certificates[0]?.uploadedAt.toISOString().slice(0, 10) ?? null,
    }));

  const reportClientId = scopedClientId ?? actor.clientId;
  const [client, allSubs, lifeImp, planted] = await Promise.all([
    reportClientId
      ? prisma.client.findUnique({
          where: { id: reportClientId },
          include: { sites: { where: { active: true }, orderBy: { name: 'asc' } } },
        })
      : Promise.resolve(null),
    prisma.submission.findMany({
      where: scope,
      include: submissionInclude,
      orderBy: { createdAt: 'desc' },
    }),
    reportClientId ? impactForClient(reportClientId, null) : Promise.resolve(computeImpact(0, 0, 0)),
    reportClientId
      ? prisma.treePlanting.aggregate({ where: { clientId: reportClientId }, _sum: { trees: true } })
      : Promise.resolve({ _sum: { trees: 0 } }),
  ]);

  const visible = siteId ? allSubs.filter((s) => s.siteId === siteId) : allSubs;
  const requests = visible.map((s) => {
    const stage = deriveSubmissionStage(s);
    return {
      id: s.id,
      siteId: s.siteId,
      siteName: s.site.name,
      stage,
      returned: stage === 1 && !!s.rejectNote,
      netKg: submissionNetKg(s),
      approxWeight: Number(s.approxWeight),
      requestDate: s.requestDate.toISOString().slice(0, 10),
      ref: s.ref,
    };
  });
  const open = requests.filter((r) => r.stage < 9).length;

  const now = new Date();
  const sites = (client?.sites ?? []).map((st) => {
    const ss = allSubs.filter((s) => s.siteId === st.id);
    // Only consider vehicles from open submissions for "Next Pickup".
    // Otherwise closed requests with stale future `expectedAt` values will
    // incorrectly show up as upcoming pickups.
    const next = ss
      .filter((s) => !s.closedAt)
      .flatMap((s) => s.vehicles.map((v) => v.expectedAt).filter((d): d is Date => !!d))
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      id: st.id,
      name: st.name,
      city: st.city,
      gstin: st.gstin,
      open: ss.filter((s) => deriveSubmissionStage(s) < 9).length,
      fyKg: ss
        .filter((s) => fyLabel && inFiscalYear(s.requestDate, fyLabel))
        .reduce((sum, s) => sum + submissionNetKg(s), 0),
      total: ss.length,
      nextPickup: next ? next.toISOString().slice(0, 10) : null,
    };
  });

  return {
    period: { fy: fyLabel, kind: resolved.kind, label: periodLabel(resolved) },
    impact,
    treesEarned: treesEarned(impact.tonnes),
    treesPlanted: planted._sum.trees ?? 0,
    treesEarnedAll: treesEarned(lifeImp.tonnes),
    lifetimeTonnes: lifeImp.tonnes,
    pendingClose: pending,
    clientName: client?.name ?? '',
    counts: { open, closed: requests.length - open, total: requests.length },
    sites,
    requests,
  };
}

export async function getReportsForActor(actor: SessionUser, siteId?: string, period?: ReportPeriod) {
  if (isStaff(actor)) {
    return { kind: 'staff' as const, ...(await getStaffDashboard(actor)) };
  }
  return { kind: 'client' as const, ...(await getImpactReport(actor, siteId, period)) };
}

export async function getCapacityReport(actor: SessionUser, factoryId: string, period?: ReportPeriod) {
  if (actor.role === 'factory' && !factoryInScope(actor, factoryId)) {
    throw new AppError('Access denied for this factory.');
  }
  if (actor.role === 'client') {
    throw new AppError('Capacity reports are for Urbeno staff only.');
  }

  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const range = capacityRange(resolved);
  const factory = await prisma.factorySite.findUnique({ where: { id: factoryId } });
  const categories = await prisma.categoryMaster.findMany({
    where: { factoryId, active: true },
    orderBy: { entryId: 'asc' },
  });

  const entries = await Promise.all(
    categories.map(async (cat) => {
      const usedKg = await usedKgInRange(factoryId, cat.entryId, range);
      const capKg = Number(cat.capacityTpa) * 1000;
      const pct = capKg > 0 ? (usedKg / capKg) * 100 : 0;
      return {
        entryId: cat.entryId,
        description: cat.description,
        groupCode: cat.groupCode,
        activity: cat.activity,
        capacityTpa: cat.capacityTpa.toString(),
        usedKg,
        remKg: Math.max(0, capKg - usedKg),
        capKg,
        pct,
        atRisk: capKg > 0 && pct >= 80 && usedKg <= capKg,
        exceeded: capKg > 0 && usedKg > capKg,
      };
    }),
  );

  entries.sort((a, b) => b.pct - a.pct);
  const authorized = entries.reduce((s, e) => s + e.capKg, 0);
  const processed = entries.reduce((s, e) => s + e.usedKg, 0);

  return {
    factoryId,
    factoryName: factory?.name ?? factoryId,
    fy: resolved.kind === 'fy' ? resolved.fy ?? currentFY()?.label ?? '' : '',
    periodLabel: periodLabel(resolved),
    stats: {
      authorized,
      processed,
      utilization: authorized > 0 ? (processed / authorized) * 100 : 0,
      atRisk: entries.filter((e) => e.atRisk || e.exceeded).length,
      over: entries.filter((e) => e.exceeded).length,
      warn: entries.filter((e) => e.atRisk).length,
    },
    entries,
    alerts: entries.filter((e) => e.atRisk || e.exceeded),
  };
}

function capacityRange(period: ReportPeriod): { start?: Date; end?: Date } {
  if (period.kind === 'all') return {};
  if (period.kind === 'fy') {
    const label = period.fy || currentFY()?.label || '';
    const fy = listFiscalYears(2020).find((f) => f.label === label) ?? currentFY();
    return fy ? fiscalYearBounds(fy) : {};
  }
  if (period.kind === 'calendar') {
    const y = period.year ?? new Date().getFullYear();
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
  }
  return {
    start: period.from ? new Date(period.from) : undefined,
    end: period.to ? new Date(`${period.to}T23:59:59.999`) : undefined,
  };
}

async function usedKgInRange(
  factoryId: string,
  entryId: string,
  range: { start?: Date; end?: Date },
): Promise<number> {
  const rows = await prisma.recyclingCategory.findMany({
    where: {
      entryId,
      recycling: {
        factoryId,
        ...(range.start || range.end
          ? { processedAt: { gte: range.start, lte: range.end } }
          : {}),
      },
    },
    select: { weightKg: true },
  });
  return rows.reduce((sum, row) => sum + Number(row.weightKg), 0);
}

export async function getHeroesReport(
  actor: SessionUser,
  period?: ReportPeriod,
  filters?: { clientId?: string },
) {
  if (actor.role === 'factory') throw new AppError('Recycle Heroes report is not available for factory accounts.');
  if (!hasFeature(actor, 'reports.heroes')) throw new AppError('You do not have access to this report.', 403);
  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const periodMeta = {
    fy: currentFY()?.label ?? '',
    kind: resolved.kind,
    label: periodLabel(resolved),
  };

  const plantings = await prisma.treePlanting.findMany({
    include: { progress: { orderBy: { notedAt: 'asc' } } },
    orderBy: { plantedAt: 'desc' },
  });
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const names = new Map(clients.map((c) => [c.id, c.name]));

  const mapPlanting = (p: (typeof plantings)[number]) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: (p.clientId && names.get(p.clientId)) || '—',
    trees: p.trees,
    plantedAt: p.plantedAt.toISOString().slice(0, 10),
    location: p.location,
    state: p.state,
    partner: p.partner,
    species: p.species,
    source: (p.source === 'client' ? 'client' : 'urbeno') as 'urbeno' | 'client',
    photoFileId: p.photoIds[0] ?? null,
    progress: p.progress.map((g) => ({
      id: g.id,
      notedAt: g.notedAt.toISOString().slice(0, 10),
      photoFileId: g.photoFileId,
      note: g.note,
    })),
  });

  const forClient = (clientId: string) => plantings.filter((p) => p.clientId === clientId);
  const countSrc = (rows: typeof plantings, src?: 'urbeno' | 'client', inPeriod = false) =>
    rows
      .filter((p) => (!src || (p.source === 'client' ? 'client' : 'urbeno') === src) && (!inPeriod || dateInPeriod(p.plantedAt, resolved)))
      .reduce((s, p) => s + p.trees, 0);

  async function metricsFor(clientId: string) {
    const periodImp = await impactForClient(clientId, resolved);
    const lifeImp = await impactForClient(clientId, null);
    const rows = forClient(clientId);
    const earned = treesEarned(periodImp.tonnes);
    const earnedAll = treesEarned(lifeImp.tonnes);
    const byUrbeno = countSrc(rows, 'urbeno');
    const byClient = countSrc(rows, 'client');
    const progress = heroProgress(earnedAll);
    return {
      tonnes: periodImp.tonnes,
      co2: periodImp.co2,
      lifetimeTonnes: lifeImp.tonnes,
      earned,
      planted: countSrc(rows, undefined, true),
      earnedAll,
      plantedAll: byUrbeno + byClient,
      byUrbeno,
      byClient,
      owed: Math.max(0, earnedAll - byUrbeno),
      ...progress,
    };
  }

  if (actor.role === 'client') {
    if (!actor.clientId) throw new AppError('No organisation is linked to this account.');
    const client = await prisma.client.findUnique({ where: { id: actor.clientId }, select: { name: true } });
    const rows = forClient(actor.clientId);
    const metrics = await metricsFor(actor.clientId);
    return {
      view: 'client' as const,
      clientName: client?.name ?? 'Your organisation',
      period: periodMeta,
      metrics,
      seq: sequestered(rows),
      plantings: rows.map(mapPlanting),
    };
  }

  const clientRows = [];
  for (const c of clients) {
    const m = await metricsFor(c.id);
    clientRows.push({
      id: c.id,
      name: c.name,
      tonnes: m.tonnes,
      lifetimeTonnes: m.lifetimeTonnes,
      earnedAll: m.earnedAll,
      byUrbeno: m.byUrbeno,
      byClient: m.byClient,
      owed: m.owed,
      badge: m.badge,
    });
  }

  const ledgerId = filters?.clientId;
  const ledger = ledgerId ? plantings.filter((p) => p.clientId === ledgerId) : plantings;

  return {
    view: 'admin' as const,
    period: periodMeta,
    totals: {
      earnedAll: clientRows.reduce((s, r) => s + r.earnedAll, 0),
      byUrbeno: clientRows.reduce((s, r) => s + r.byUrbeno, 0),
      byClient: clientRows.reduce((s, r) => s + r.byClient, 0),
      owed: clientRows.reduce((s, r) => s + r.owed, 0),
      seq: sequestered(plantings),
    },
    clients: clientRows,
    plantings: ledger.map(mapPlanting),
  };
}

export const REGISTER_KINDS = {
  summary: { title: 'Request Summary', description: 'Every request with stage, weight and dates' },
  invoices: { title: 'Invoice Register', description: 'All invoices with e-way, payment status and outstanding' },
  mrn: { title: 'MRN Register', description: 'Goods received at factory sites — internal', staffOnly: true },
  form6: { title: 'Form 6 Log', description: 'Processing records with categories' },
  cod: { title: 'Certificate Log', description: 'Certificates issued and closure status' },
  category: { title: 'Category Recovery', description: 'Weight recovered by authorized category' },
  sustain: { title: 'Sustainability', description: 'Environmental impact with methodology' },
  heroes: { title: 'Recycle Heroes', description: 'Tonnage and tree milestones' },
} as const;

export type RegisterType = keyof typeof REGISTER_KINDS;

export interface RegisterReport {
  kind: RegisterType;
  title: string;
  description: string;
  periodLabel: string;
  scopeLabel: string;
  head: string[];
  rows: Array<Array<string | number>>;
  total: number;
}

const HERO_MILESTONE = 10;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function rupees(paise: bigint | number): number {
  return Math.round(Number(paise)) / 100;
}

function mrnMats(materials: unknown): Array<{ q?: number; w?: number }> {
  return Array.isArray(materials) ? (materials as Array<{ q?: number; w?: number }>) : [];
}

function registerScope(
  actor: SessionUser,
  clientId?: string,
  siteId?: string,
): Record<string, unknown> {
  const base = clientScopeFilter(actor);
  if (!isStaff(actor)) {
    return siteId ? { ...base, siteId } : base;
  }
  return {
    ...base,
    ...(clientId ? { clientId } : {}),
    ...(siteId ? { siteId } : {}),
  };
}

async function impactForClient(clientId: string, period: ReportPeriod | null, siteId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      closedAt: { not: null },
      submission: { clientId, ...(siteId ? { siteId } : {}) },
    },
    select: { billingWeight: true, closedAt: true, submissionId: true },
  });
  const inPeriod = period
    ? invoices.filter((inv) => inv.closedAt && dateInPeriod(inv.closedAt, period))
    : invoices;
  const kg = inPeriod.reduce((sum, inv) => sum + Number(inv.billingWeight), 0);
  return computeImpact(kg, inPeriod.length, new Set(inPeriod.map((i) => i.submissionId)).size);
}

export async function getRegisterReport(
  actor: SessionUser,
  type: RegisterType,
  period?: ReportPeriod,
  filters?: { clientId?: string; siteId?: string },
): Promise<RegisterReport> {
  const meta = REGISTER_KINDS[type];
  const staff = isStaff(actor);
  if (!staff && (type === 'mrn' || type === 'form6' || type === 'cod' || type === 'category')) {
    throw new AppError('This report is for Urbeno staff only.');
  }
  const ADMIN_ONLY_REPORTS: RegisterType[] = ['summary', 'invoices', 'sustain', 'heroes'];
  if (actor.role === 'factory' && ADMIN_ONLY_REPORTS.includes(type)) {
    throw new AppError('This report is not available for factory accounts.');
  }
  // Per-user feature-access gate
  if (!hasFeature(actor, `reports.${type}`)) {
    throw new AppError('You do not have access to this report.', 403);
  }

  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const inP = (d: Date) => dateInPeriod(d, resolved);
  const clientId = staff ? filters?.clientId : actor.clientId ?? undefined;
  const siteId = filters?.siteId;
  const scope = registerScope(actor, clientId, siteId);

  const clientName =
    clientId
      ? (await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name
      : null;
  const siteName =
    siteId
      ? (await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name
      : null;
  const scopeParts = [
    actor.role === 'client' ? clientName || 'Your organisation' : clientName || 'All clients',
    siteName || 'All sites',
  ];

  let head: string[] = [];
  let rows: Array<Array<string | number>> = [];

  if (type === 'summary') {
    head = ['Request', 'Client', 'Site', 'PO Ref', 'Raised', 'Stage', 'Vehicles', 'Invoices', 'Declared kg', 'Net kg', 'Closed'];
    const subs = await prisma.submission.findMany({
      where: scope,
      include: submissionInclude,
      orderBy: { requestDate: 'desc' },
      take: 2000,
    });
    rows = subs.filter((s) => inP(s.requestDate)).map((s) => {
      const stage = deriveSubmissionStage(s);
      return [
        s.id,
        s.client.name,
        s.site.name,
        s.ref || '',
        fmtDate(s.requestDate),
        `${stage} · ${stageLabel(stage)}`,
        s.vehicles.length,
        s.invoices.length,
        Number(s.approxWeight),
        Number(submissionNetKg(s).toFixed(3)),
        s.closedAt ? fmtDate(s.closedAt) : '',
      ];
    });
  } else if (type === 'invoices') {
    head = ['Invoice', 'Request', 'Client', 'Date', 'Taxable', 'GST', 'Total', 'Paid', 'Outstanding', 'Status', 'E-way Bill', 'Stage'];
    const invoices = await prisma.invoice.findMany({
      where: { submission: scope },
      include: {
        payments: true,
        mrn: true,
        recycling: true,
        certificates: true,
        submission: { include: { client: true } },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 2000,
    });
    rows = invoices.filter((inv) => inP(inv.invoiceDate)).map((inv) => {
      const paid = settledPaise(inv.payments);
      const pay = getPayStatus(inv.totalPaise, paid);
      const tot = rupees(inv.totalPaise);
      const paidR = rupees(paid);
      return [
        inv.invoiceNo,
        inv.submissionId,
        inv.submission.client.name,
        fmtDate(inv.invoiceDate),
        rupees(inv.taxablePaise),
        rupees(inv.taxPaise),
        tot,
        paidR,
        Number((tot - paidR).toFixed(2)),
        pay.label,
        inv.ewayBillNo || '',
        invoiceStage(inv),
      ];
    });
  } else if (type === 'mrn') {
    head = ['MRN', 'Invoice', 'Request', 'Client', 'Factory', 'Received', 'Vehicles', 'Qty', 'Weight kg', 'Received By'];
    const mrns = await prisma.mrn.findMany({
      where: { invoice: { submission: scope } },
      include: {
        factory: true,
        invoice: { include: { submission: { include: { client: true } } } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 2000,
    });
    rows = mrns
      .filter((m) => factoryInScope(actor, m.factoryId) && inP(m.receivedAt))
      .map((m) => {
        const mats = mrnMats(m.materials);
        return [
          m.mrnNo,
          m.invoice.invoiceNo,
          m.invoice.submissionId,
          m.invoice.submission.client.name,
          m.factory.name,
          fmtDate(m.receivedAt),
          m.invoice.vehicleIds.length,
          mats.reduce((a, x) => a + Number(x.q ?? 0), 0),
          Number(mats.reduce((a, x) => a + Number(x.w ?? 0), 0).toFixed(3)),
          m.receivedBy,
        ];
      });
  } else if (type === 'form6') {
    head = ['Form 6', 'Invoice', 'Request', 'Client', 'Processed', 'Facility', 'E-way Bill', 'Vehicles', 'Categories', 'Devices', 'Weight kg'];
    const recys = await prisma.recycling.findMany({
      where: { invoice: { submission: scope } },
      include: {
        factory: true,
        categories: true,
        serials: true,
        invoice: { include: { submission: { include: { client: true } } } },
      },
      orderBy: { processedAt: 'desc' },
      take: 2000,
    });
    rows = recys
      .filter((r) => (actor.role !== 'factory' || factoryInScope(actor, r.factoryId)) && inP(r.processedAt))
      .map((r) => [
        r.form6No,
        r.invoice.invoiceNo,
        r.invoice.submissionId,
        r.invoice.submission.client.name,
        fmtDate(r.processedAt),
        r.factory.name,
        r.invoice.ewayBillNo || '',
        r.vehicleIds.length || r.invoice.vehicleIds.length,
        r.categories.map((c) => c.entryId).join(' / '),
        r.serials.length,
        Number(r.categories.reduce((a, c) => a + Number(c.weightKg), 0).toFixed(3)),
      ]);
  } else if (type === 'cod') {
    head = ['Certificate', 'Date', 'Department', 'Invoice', 'Request', 'Client', 'Form 6', 'Uploaded', 'Emailed', 'Closed By', 'Closed On', 'Rating'];
    const certs = await prisma.certificate.findMany({
      where: { invoice: { submission: scope } },
      include: {
        invoice: {
          include: {
            recycling: true,
            submission: { include: { client: true } },
          },
        },
      },
      orderBy: { certDate: 'desc' },
      take: 2000,
    });
    rows = certs.filter((c) => inP(c.certDate)).map((c) => [
      c.certNo,
      fmtDate(c.certDate),
      c.department || '',
      c.invoice.invoiceNo,
      c.invoice.submissionId,
      c.invoice.submission.client.name,
      c.invoice.recycling?.form6No || '',
      fmtTs(c.uploadedAt),
      c.mailedAt ? 'Yes' : 'No',
      c.invoice.closedBy || '',
      c.invoice.closedAt ? fmtDate(c.invoice.closedAt) : '',
      c.invoice.closeRating ?? '',
    ]);
  } else if (type === 'category') {
    head = ['Entry', 'Description', 'Group', 'Activity', 'Authorized TPA', 'Recovered kg', 'Utilization %'];
    const recys = await prisma.recycling.findMany({
      where: { invoice: { submission: scope } },
      include: { categories: true },
      take: 2000,
    });
    const used: Record<string, number> = {};
    for (const r of recys.filter((row) => inP(row.processedAt))) {
      for (const c of r.categories) {
        used[c.entryId] = (used[c.entryId] || 0) + Number(c.weightKg);
      }
    }
    const entryIds = Object.keys(used);
    const cats = entryIds.length
      ? await prisma.categoryMaster.findMany({
          where: { active: true, entryId: { in: entryIds } },
          orderBy: { entryId: 'asc' },
        })
      : [];
    rows = cats.map((c) => {
      const kg = used[c.entryId] || 0;
      const tpa = Number(c.capacityTpa);
      return [
        c.entryId,
        c.description,
        c.groupCode,
        c.activity,
        tpa,
        Number(kg.toFixed(3)),
        tpa ? Number(((kg / (tpa * 1000)) * 100).toFixed(3)) : '—',
      ];
    });
  } else if (type === 'sustain') {
    head = ['Client ID', 'Client', 'Site', 'Closed Invoices', 'Net kg', 'Tonnes', 'CO2e avoided kg', 'Landfill diverted kg', 'Tree equivalent', 'Water kL', 'Energy kWh'];
    const clients = clientId
      ? await prisma.client.findMany({ where: { id: clientId } })
      : actor.role === 'client' && actor.clientId
        ? await prisma.client.findMany({ where: { id: actor.clientId } })
        : await prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    for (const c of clients) {
      const imp = await impactForClient(c.id, resolved, siteId);
      if (!imp.invoices) continue;
      rows.push([
        c.id,
        c.name,
        siteName || 'All sites',
        imp.invoices,
        Number(imp.kg.toFixed(1)),
        Number(imp.tonnes.toFixed(3)),
        Number(imp.co2.toFixed(1)),
        Number(imp.landfill.toFixed(1)),
        Number(imp.trees.toFixed(1)),
        Number(imp.water.toFixed(1)),
        Number(imp.energy.toFixed(1)),
      ]);
    }
  } else {
    head = ['Client', 'Tonnes (period)', 'Trees earned (period)', 'Trees planted (period)', 'Tonnes (lifetime)', 'Trees earned (lifetime)', 'Trees planted (lifetime)', 'Outstanding', 'Milestone'];
    const clients = clientId
      ? await prisma.client.findMany({ where: { id: clientId } })
      : actor.role === 'client' && actor.clientId
        ? await prisma.client.findMany({ where: { id: actor.clientId } })
        : await prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    const plantings = await prisma.treePlanting.findMany({
      where: clientId || actor.clientId ? { clientId: clientId || actor.clientId } : {},
    });
    for (const c of clients) {
      const periodImp = await impactForClient(c.id, resolved, siteId);
      const lifeImp = await impactForClient(c.id, null, siteId);
      const earned = treesEarned(periodImp.tonnes);
      const earnedAll = treesEarned(lifeImp.tonnes);
      const planted = plantings
        .filter((p) => p.clientId === c.id && dateInPeriod(p.plantedAt, resolved))
        .reduce((s, p) => s + p.trees, 0);
      const plantedAll = plantings.filter((p) => p.clientId === c.id).reduce((s, p) => s + p.trees, 0);
      const byUrbeno = plantings
        .filter((p) => p.clientId === c.id && p.source !== 'client')
        .reduce((s, p) => s + p.trees, 0);
      const badge = Math.floor(earnedAll / HERO_MILESTONE) * HERO_MILESTONE;
      rows.push([
        c.name,
        Number(periodImp.tonnes.toFixed(3)),
        earned,
        planted,
        Number(lifeImp.tonnes.toFixed(3)),
        earnedAll,
        plantedAll,
        Math.max(0, earnedAll - byUrbeno),
        badge || '',
      ]);
    }
  }

  return {
    kind: type,
    title: meta.title,
    description: meta.description,
    periodLabel: periodLabel(resolved),
    scopeLabel: scopeParts.join(' · '),
    head,
    rows,
    total: rows.length,
  };
}

export async function shareImpactReport(actor: SessionUser, clientId: string, period?: ReportPeriod) {
  requireAdmin(actor);
  const client = await prisma.client.findUnique({ where: { id: clientId, active: true } });
  if (!client) throw new AppError('Client not found.');
  const report = await getImpactReport(actor, undefined, period, clientId);
  if (!report.impact.invoices) {
    throw new AppError('No closed requests in this period for this client — nothing to share yet.');
  }
  const users = await prisma.user.findMany({
    where: { clientId, active: true, role: 'client' },
    select: { email: true },
  });
  if (!users.length) throw new AppError('This client has no active portal users to share with.');
  const portal = process.env.PORTAL_URL ?? 'http://localhost:8080';
  await sendTransactionalEmail(
    'impact_share',
    users.map((u) => u.email),
    {
      client_name: client.name,
      contact_name: client.contact || client.name,
      period_label: report.period.label,
      kg: Number(report.impact.kg.toFixed(1)),
      co2: Number(report.impact.co2.toFixed(0)),
      landfill: Number(report.impact.landfill.toFixed(0)),
      water: Number(report.impact.water.toFixed(1)),
      energy: Number(report.impact.energy.toFixed(1)),
      invoices: report.impact.invoices,
      portal_url: `${portal}/impact`,
    },
  );
  return { sent: users.length, recipients: users.map((u) => u.email), clientName: client.name };
}
