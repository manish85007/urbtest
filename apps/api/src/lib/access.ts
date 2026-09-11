import type { SessionUser } from './auth-context.js';
import { can, clientScopeFilter, factoryInScope, isStaff } from './auth-context.js';
import type { RolePermissionKey } from '@urb-tectrack/shared';
import { AppError } from './errors.js';
import { prisma } from './prisma.js';
import { submissionInclude, type SubmissionFull } from './db-helpers.js';
import { deriveSubmissionStage } from './stage-mapper.js';
import { denyAccess } from '../services/security-log.js';
import {
  clientFacingLifecycleSummary,
  hideActorIdentityOnClientPortal,
  portalActorRoleLabel,
} from '../services/submission-lifecycle.js';

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

type LifecycleEventLike = {
  event: string;
  summary: string;
  actorEmail: string;
  actorRole?: string | null;
  details?: unknown;
  [key: string]: unknown;
};

async function roleByEmails(emails: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: {
      OR: unique.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
    },
    select: { email: true, role: true },
  });
  const map = new Map<string, string>();
  for (const u of users) map.set(u.email.toLowerCase(), u.role);
  return map;
}

function redactStaffEmailField(
  email: string | null | undefined,
  roles: Map<string, string>,
): string | null | undefined {
  if (email == null) return email;
  const role = roles.get(email.toLowerCase());
  if (!hideActorIdentityOnClientPortal(role, email)) return email;
  return portalActorRoleLabel(role, email);
}

function redactLifecycleEvent(
  ev: LifecycleEventLike,
  roles: Map<string, string>,
): LifecycleEventLike & { actorLabel: string } {
  const role = ev.actorRole ?? roles.get(ev.actorEmail.toLowerCase()) ?? null;
  if (!hideActorIdentityOnClientPortal(role, ev.actorEmail)) {
    return {
      ...ev,
      actorLabel: ev.actorEmail,
    };
  }
  const label = portalActorRoleLabel(role, ev.actorEmail);
  return {
    ...ev,
    summary: clientFacingLifecycleSummary(ev.event, label, ev.summary),
    actorEmail: '',
    actorRole: role,
    actorLabel: '',
  };
}

/** Rule R4 — clients never see MRN documents, but keep hasMrn for lifecycle UI.
 *  Form 6 + CoD are hidden until Super Admin certifies (clientPublishedAt).
 *  Staff name/email on lifecycle + ack fields are replaced with role titles. */
export async function redactSubmissionForActor<T extends {
  invoices: Array<{
    mrn: unknown;
    hasMrn?: boolean;
    recycling?: { reviewStatus?: string; clientPublishedAt?: Date | string | null } | null;
    certificates?: unknown[];
  }>;
  lifecycleEvents?: LifecycleEventLike[];
  acknowledgedBy?: string | null;
  loadingCompletedBy?: string | null;
  rejectBy?: string | null;
}>(sub: T, actor: SessionUser): Promise<T> {
  if (isStaff(actor) || actor.role === 'auditor') return sub;

  const emails: string[] = [];
  for (const ev of sub.lifecycleEvents ?? []) {
    if (ev.actorEmail) emails.push(ev.actorEmail);
  }
  if (sub.acknowledgedBy) emails.push(sub.acknowledgedBy);
  if (sub.loadingCompletedBy) emails.push(sub.loadingCompletedBy);
  if (sub.rejectBy) emails.push(sub.rejectBy);

  const roles = await roleByEmails(emails);

  return {
    ...sub,
    acknowledgedBy: redactStaffEmailField(sub.acknowledgedBy, roles) as T['acknowledgedBy'],
    loadingCompletedBy: redactStaffEmailField(sub.loadingCompletedBy, roles) as T['loadingCompletedBy'],
    rejectBy: redactStaffEmailField(sub.rejectBy, roles) as T['rejectBy'],
    lifecycleEvents: (sub.lifecycleEvents ?? []).map((ev) => redactLifecycleEvent(ev, roles)),
    invoices: sub.invoices.map((inv) => {
      const published =
        inv.recycling?.reviewStatus === 'approved' && !!inv.recycling?.clientPublishedAt;
      return {
        ...inv,
        hasMrn: inv.hasMrn ?? !!inv.mrn,
        mrn: null,
        recycling: published ? inv.recycling : null,
        certificates: published ? (inv.certificates ?? []) : [],
      };
    }),
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
