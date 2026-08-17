import type { SessionUser } from './auth-context.js';
import { clientScopeFilter, factoryInScope, isStaff } from './auth-context.js';
import { AppError } from './errors.js';
import { prisma } from './prisma.js';
import { submissionInclude, type SubmissionFull } from './db-helpers.js';
import { deriveSubmissionStage } from './stage-mapper.js';
import { denyAccess } from '../services/security-log.js';

export async function loadSubmissionForActor(
  id: string,
  actor: SessionUser,
): Promise<SubmissionFull> {
  const found = await prisma.submission.findUnique({
    where: { id },
    include: submissionInclude,
  });
  if (!found) throw new AppError('Request not found', 404);

  const scoped = await prisma.submission.findFirst({
    where: { id, ...clientScopeFilter(actor) },
    include: submissionInclude,
  });
  if (!scoped) {
    await denyAccess(
      actor.email,
      actor.role,
      'request',
      id,
      "outside the signed-in user's client or site scope",
    );
    throw new AppError("You don't have access to this request", 403);
  }
  return scoped;
}

export async function loadInvoiceForActor(invoiceId: string, actor: SessionUser) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      submission: { include: submissionInclude },
      payments: true,
      mrn: { include: { factory: true } },
      recycling: { include: { categories: { include: { category: true } }, serials: true, factory: true } },
      certificates: true,
    },
  });
  if (!invoice) throw new AppError('Invoice not found', 404);

  const scope = clientScopeFilter(actor);
  if ('clientId' in scope && scope.clientId && invoice.submission.clientId !== scope.clientId) {
    throw new AppError('Invoice not found', 404);
  }
  if (
    'siteId' in scope &&
    scope.siteId &&
    typeof scope.siteId === 'object' &&
    'in' in scope.siteId &&
    Array.isArray(scope.siteId.in) &&
    !scope.siteId.in.includes(invoice.submission.siteId)
  ) {
    throw new AppError('Invoice not found', 404);
  }

  return invoice;
}

export function requireAdmin(actor: SessionUser) {
  if (actor.role !== 'admin') throw new AppError('Admin access required.', 403);
}

export function requireStaff(actor: SessionUser) {
  if (!isStaff(actor)) throw new AppError('Staff access required.', 403);
}

export function requireFactory(actor: SessionUser, factoryId: string) {
  if (!factoryInScope(actor, factoryId)) {
    throw new AppError('Factory access required for this facility.', 403);
  }
}

/** Rule R4 — clients never see MRNs. */
export function redactSubmissionForActor<T extends { invoices: Array<{ mrn: unknown }> }>(
  sub: T,
  actor: SessionUser,
): T {
  if (isStaff(actor)) return sub;
  return {
    ...sub,
    invoices: sub.invoices.map((inv) => ({ ...inv, mrn: null })),
  };
}

export function assertSubmissionStage(sub: SubmissionFull, expected: number, message: string) {
  const stage = deriveSubmissionStage(sub);
  if (stage !== expected) throw new AppError(message);
}

export async function syncSubmissionClosure(submissionId: string) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { invoices: true },
  });
  if (!sub || sub.invoices.length === 0) return;

  const allClosed = sub.invoices.every((inv) => !!inv.closedAt);
  await prisma.submission.update({
    where: { id: submissionId },
    data: { closedAt: allClosed ? new Date() : null },
  });
}
