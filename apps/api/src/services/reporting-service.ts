import {
  SLA_LABEL,
  computeImpact,
  currentFY,
  dateInPeriod,
  getPayStatus,
  inFiscalYear,
  invStage,
  invoiceDue,
  parseReportPeriod,
  paymentTermsLabel,
  periodLabel,
  recyclingSla,
  sumPaise,
  treesEarned,
  type ReportPeriod,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { clientScopeFilter, factoryInScope, isStaff } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude, type SubmissionFull } from '../lib/db-helpers.js';
import { deriveSubmissionStage } from '../lib/stage-mapper.js';
import { getCategoryUsedKg } from './category-capacity.js';
import { AppError } from '../lib/errors.js';

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

export async function getStaffDashboard(actor: SessionUser) {
  const [submissions, openInvoices, reminderLogs] = await Promise.all([
    prisma.submission.findMany({
      where: { ...clientScopeFilter(actor), closedAt: null },
      include: submissionInclude,
      orderBy: { createdAt: 'desc' },
    }),
    loadInvoiceRows(actor),
    prisma.reminderLog.findMany({ where: { key: { startsWith: 'pay:' } } }),
  ]);

  const reminderByKey = new Map(reminderLogs.map((r) => [r.key, r.count]));

  const newRequests = submissions
    .filter((s) => deriveSubmissionStage(s) === 1)
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
    const paidPaise = sumPaise(inv.payments.map((p) => p.amountPaise));
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
    const paid = sumPaise(inv.payments.map((p) => p.amountPaise));
    return getPayStatus(inv.totalPaise, paid).key !== 'paid';
  }).length;

  const fy = currentFY();
  const fyLabel = fy?.label ?? '';
  const fyNetKg = submissions
    .filter((s) => fyLabel && inFiscalYear(s.requestDate, fyLabel))
    .reduce((sum, s) => sum + submissionNetKg(s), 0);

  return {
    stats: {
      newRequests: newRequests.length,
      openRequests: submissions.length,
      openInvoices: openInvoices.length,
      pendingPayments,
      fyNetKg,
      fyLabel,
    },
    newRequests,
    overdue,
    slaAtRisk,
    queues,
  };
}

export async function getImpactReport(actor: SessionUser, siteId?: string, period?: ReportPeriod) {
  const scope = clientScopeFilter(actor);
  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const fy = currentFY();
  const fyLabel = fy?.label ?? '';

  const where: Record<string, unknown> = {
    closedAt: { not: null },
    submission: scope,
  };
  if (siteId) {
    where.submission = { ...scope, siteId };
  }

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

  return {
    period: { fy: fyLabel, kind: resolved.kind, label: periodLabel(resolved) },
    impact,
    treesEarned: treesEarned(impact.tonnes),
    pendingClose: pending,
  };
}

export async function getReportsForActor(actor: SessionUser, siteId?: string, period?: ReportPeriod) {
  if (isStaff(actor)) {
    return { kind: 'staff' as const, ...(await getStaffDashboard(actor)) };
  }
  return { kind: 'client' as const, ...(await getImpactReport(actor, siteId, period)) };
}

export async function getCapacityReport(actor: SessionUser, factoryId: string) {
  if (actor.role === 'factory' && !factoryInScope(actor, factoryId)) {
    throw new AppError('Access denied for this factory.');
  }
  if (actor.role === 'client') {
    throw new AppError('Capacity reports are for Urbeno staff only.');
  }

  const fy = currentFY();
  const categories = await prisma.categoryMaster.findMany({
    where: { factoryId, active: true },
    orderBy: { entryId: 'asc' },
  });

  const entries = await Promise.all(
    categories.map(async (cat) => {
      const usedKg = await getCategoryUsedKg(factoryId, cat.entryId, new Date());
      const capKg = Number(cat.capacityTpa) * 1000;
      const pct = capKg > 0 ? (usedKg / capKg) * 100 : 0;
      return {
        entryId: cat.entryId,
        description: cat.description,
        groupCode: cat.groupCode,
        activity: cat.activity,
        capacityTpa: cat.capacityTpa.toString(),
        usedKg,
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
    fy: fy?.label ?? '',
    stats: {
      authorized,
      processed,
      utilization: authorized > 0 ? (processed / authorized) * 100 : 0,
      atRisk: entries.filter((e) => e.atRisk || e.exceeded).length,
    },
    entries,
    alerts: entries.filter((e) => e.atRisk || e.exceeded),
  };
}

export async function getHeroesReport(actor: SessionUser, period?: ReportPeriod) {
  const impact = await getImpactReport(actor, undefined, period);
  const plantings = await prisma.treePlanting.findMany({
    where: actor.role === 'client' && actor.clientId ? { clientId: actor.clientId } : {},
    include: { progress: { orderBy: { notedAt: 'asc' } } },
    orderBy: { plantedAt: 'desc' },
    take: 50,
  });

  const plantedTotal = plantings.reduce((s, p) => s + p.trees, 0);

  return {
    period: impact.period,
    impact: impact.impact,
    treesEarned: impact.treesEarned,
    treesPlanted: plantedTotal,
    outstanding: Math.max(0, impact.treesEarned - plantedTotal),
    plantings: plantings.map((p) => ({
      id: p.id,
      trees: p.trees,
      plantedAt: p.plantedAt.toISOString().slice(0, 10),
      location: p.location,
      note: p.note,
      clientId: p.clientId,
      progress: p.progress.map((g) => ({
        id: g.id,
        notedAt: g.notedAt.toISOString().slice(0, 10),
        photoFileId: g.photoFileId,
        note: g.note,
      })),
    })),
  };
}

export type RegisterType = 'summary' | 'invoices' | 'mrn' | 'form6' | 'cod';

export async function getRegisterReport(actor: SessionUser, type: RegisterType, period?: ReportPeriod) {
  const scope = clientScopeFilter(actor);
  const staff = isStaff(actor);
  const resolved = period ?? parseReportPeriod({ period: 'fy' });
  const inP = (d: Date) => dateInPeriod(d, resolved);

  if (type === 'mrn' && !staff) {
    throw new AppError('MRN register is for Urbeno staff only.');
  }

  if (type === 'summary') {
    const subs = await prisma.submission.findMany({
      where: scope,
      include: submissionInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return subs.filter((s) => inP(s.requestDate)).map((s) => ({
      id: s.id,
      client: s.client.name,
      site: s.site.name,
      stage: deriveSubmissionStage(s),
      requestDate: s.requestDate.toISOString().slice(0, 10),
      netKg: submissionNetKg(s),
      invoices: s.invoices.length,
      closed: !!s.closedAt,
    }));
  }

  if (type === 'invoices') {
    const rows = await prisma.invoice.findMany({
      where: { submission: scope },
      include: { submission: { include: { client: true } }, payments: true },
      orderBy: { invoiceDate: 'desc' },
      take: 500,
    });
    return rows.filter((inv) => inP(inv.invoiceDate)).map((inv) => {
      const paid = sumPaise(inv.payments.map((p) => p.amountPaise));
      const pay = getPayStatus(inv.totalPaise, paid);
      return {
        invoiceNo: inv.invoiceNo,
        submissionId: inv.submissionId,
        client: inv.submission.client.name,
        date: inv.invoiceDate.toISOString().slice(0, 10),
        totalPaise: inv.totalPaise.toString(),
        billingWeight: inv.billingWeight.toString(),
        paymentStatus: pay.key,
        closed: !!inv.closedAt,
      };
    });
  }

  if (type === 'mrn') {
    const rows = await prisma.mrn.findMany({
      where: { invoice: { submission: scope } },
      include: { invoice: { include: { submission: { include: { client: true } } } }, factory: true },
      orderBy: { receivedAt: 'desc' },
      take: 500,
    });
    const visible = actor.role === 'factory' ? rows.filter((m) => factoryInScope(actor, m.factoryId)) : rows;
    return visible.filter((m) => inP(m.receivedAt)).map((m) => ({
      mrnNo: m.mrnNo,
      invoiceNo: m.invoice.invoiceNo,
      submissionId: m.invoice.submissionId,
      client: m.invoice.submission.client.name,
      factory: m.factory.name,
      receivedAt: m.receivedAt.toISOString().slice(0, 10),
    }));
  }

  if (type === 'form6') {
    const rows = await prisma.recycling.findMany({
      where: { invoice: { submission: scope } },
      include: { invoice: { include: { submission: { include: { client: true } } } }, factory: true },
      orderBy: { processedAt: 'desc' },
      take: 500,
    });
    return rows.filter((r) => inP(r.processedAt)).map((r) => ({
      form6No: r.form6No,
      invoiceNo: r.invoice.invoiceNo,
      submissionId: r.invoice.submissionId,
      client: r.invoice.submission.client.name,
      factory: r.factory.name,
      processedAt: r.processedAt.toISOString().slice(0, 10),
      divertedPct: r.divertedPct.toString(),
    }));
  }

  const rows = await prisma.certificate.findMany({
    where: { invoice: { submission: scope } },
    include: { invoice: { include: { submission: { include: { client: true } } } } },
    orderBy: { certDate: 'desc' },
    take: 500,
  });
  return rows.filter((c) => inP(c.certDate)).map((c) => ({
    certNo: c.certNo,
    invoiceNo: c.invoice.invoiceNo,
    submissionId: c.invoice.submissionId,
    client: c.invoice.submission.client.name,
    certDate: c.certDate.toISOString().slice(0, 10),
    department: c.department,
  }));
}
