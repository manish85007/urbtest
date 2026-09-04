import type { SessionUser } from './auth-context.js';
import { can, clientScopeFilter, factoryInScope, isStaff } from './auth-context.js';
import type { RolePermissionKey } from '@urb-tectrack/shared';
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
  // Scope at the DB layer (same pattern as loadSubmissionForActor) so out-of-scope
  // invoices are never loaded into memory before the access check.
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      submission: clientScopeFilter(actor),
    },
    include: {
      submission: { include: submissionInclude },
      payments: true,
      mrn: { include: { factory: true } },
      recycling: { include: { categories: { include: { category: true } }, serials: true, factory: true } },
      certificates: true,
    },
  });
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
}

export function requireAdmin(actor: SessionUser) {
  if (actor.role !== 'admin') throw new AppError('Admin access required.', 403);
}

export function requireStaff(actor: SessionUser) {
  if (!isStaff(actor)) throw new AppError('Staff access required.', 403);
}

export function requirePermission(actor: SessionUser, permission: RolePermissionKey) {
  if (!can(actor, permission)) {
    throw new AppError('You do not have permission for this action.', 403);
  }
}

export function requireFactory(actor: SessionUser, factoryId: string) {
  if (!factoryInScope(actor, factoryId)) {
    throw new AppError('Factory access required for this facility.', 403);
  }
}

/** Rule R4 — clients never see MRN documents, but keep hasMrn for lifecycle UI.
 *  Form 6 is hidden from clients until admin approval (reviewStatus === 'approved'). */
export function redactSubmissionForActor<T extends {
  invoices: Array<{
    mrn: unknown;
    hasMrn?: boolean;
    recycling?: { reviewStatus?: string } | null;
  }>;
}>(sub: T, actor: SessionUser): T {
  if (isStaff(actor) || actor.role === 'auditor') return sub;
  return {
    ...sub,
    invoices: sub.invoices.map((inv) => ({
      ...inv,
      hasMrn: inv.hasMrn ?? !!inv.mrn,
      mrn: null,
      recycling: inv.recycling?.reviewStatus === 'approved' ? inv.recycling : null,
    })),
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
