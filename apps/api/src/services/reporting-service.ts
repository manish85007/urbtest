import {
  SLA_LABEL,
  computeImpact,
  currentFY,
  getPayStatus,
  inFiscalYear,
  invStage,
  invoiceDue,
  paymentTermsLabel,
  recyclingSla,
  sumPaise,
  treesEarned,
} from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { clientScopeFilter, isStaff } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';
import { submissionInclude, type SubmissionFull } from '../lib/db-helpers.js';
import { deriveSubmissionStage } from '../lib/stage-mapper.js';

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
  return actor.factoryIds.includes(inv.mrn.factoryId);
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

export async function getImpactReport(actor: SessionUser, siteId?: string) {
  const scope = clientScopeFilter(actor);
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
    (inv) => inv.closedAt && fyLabel && inFiscalYear(inv.closedAt, fyLabel),
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
    period: { fy: fyLabel },
    impact,
    treesEarned: treesEarned(impact.tonnes),
    pendingClose: pending,
  };
}

export async function getReportsForActor(actor: SessionUser, siteId?: string) {
  if (isStaff(actor)) {
    return { kind: 'staff' as const, ...(await getStaffDashboard(actor)) };
  }
  return { kind: 'client' as const, ...(await getImpactReport(actor, siteId)) };
}
