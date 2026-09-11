import type { Prisma } from '@prisma/client';
import { isAuditorRole, isStaffRole, roleDisplayLabel } from '@urb-tectrack/shared';
import type { SessionUser } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';

export type SubmissionLifecycleEventKind =
  | 'created'
  | 'returned'
  | 'resubmitted'
  | 'acknowledged'
  | 'loading_complete'
  | 'requestor_assigned';

const EVENT_LABELS: Record<SubmissionLifecycleEventKind, string> = {
  created: 'Request raised',
  returned: 'Returned to requestor',
  resubmitted: 'Requestor resubmitted',
  acknowledged: 'Acknowledged by Urbeno',
  loading_complete: 'Loading complete',
  requestor_assigned: 'Requestor assigned for closure',
};

export function lifecycleEventLabel(event: string): string {
  return EVENT_LABELS[event as SubmissionLifecycleEventKind] ?? event;
}

export async function logSubmissionLifecycle(
  submissionId: string,
  event: SubmissionLifecycleEventKind,
  summary: string,
  actor: SessionUser,
  details?: Record<string, unknown>,
) {
  return prisma.submissionLifecycleEvent.create({
    data: {
      submissionId,
      event,
      summary,
      actorEmail: actor.email,
      actorRole: actor.role,
      details: (details ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/** Staff / auditor identity must not appear on the client portal. */
export function hideActorIdentityOnClientPortal(
  role: string | null | undefined,
  email?: string | null,
): boolean {
  if (role && (isStaffRole(role) || isAuditorRole(role))) return true;
  if (email && /@urbeno\.in$/i.test(email)) return true;
  return false;
}

export function portalActorRoleLabel(
  role: string | null | undefined,
  email?: string | null,
): string {
  if (role) return roleDisplayLabel(role);
  if (email && /@urbeno\.in$/i.test(email)) return 'Urbeno';
  return 'Urbeno';
}

/** Rewrite stored summaries that embed staff names for client display. */
export function clientFacingLifecycleSummary(
  event: string,
  roleLabel: string,
  originalSummary: string,
): string {
  switch (event) {
    case 'created':
      return `Request raised by ${roleLabel}`;
    case 'acknowledged':
      return `Acknowledged by ${roleLabel}`;
    case 'loading_complete':
      return `Loading complete — confirmed by ${roleLabel}`;
    case 'returned':
    case 'resubmitted':
      return originalSummary;
    case 'requestor_assigned':
      return originalSummary;
    default:
      return originalSummary;
  }
}

export function summarizeSubmissionChanges(
  before: {
    location?: string | null;
    approxQty?: number;
    approxWeight?: unknown;
    notes?: string | null;
    ref?: string | null;
    siteId?: string;
    requestDate?: Date;
  },
  after: {
    location?: string;
    approxQty?: number;
    approxWeight?: number;
    notes?: string;
    ref?: string;
    siteId?: string;
    requestDate?: string;
  },
): string[] {
  const changes: string[] = [];
  if (after.location !== undefined && (after.location || '') !== (before.location || '')) {
    changes.push(`Pickup location → ${after.location || '—'}`);
  }
  if (after.approxQty !== undefined && after.approxQty !== before.approxQty) {
    changes.push(`Approx. quantity → ${after.approxQty}`);
  }
  if (after.approxWeight !== undefined && Number(after.approxWeight) !== Number(before.approxWeight)) {
    changes.push(`Approx. weight → ${after.approxWeight} kg`);
  }
  if (after.notes !== undefined && (after.notes || '') !== (before.notes || '')) {
    changes.push('Notes updated');
  }
  if (after.ref !== undefined && (after.ref || '') !== (before.ref || '')) {
    changes.push(`PO / reference → ${after.ref || '—'}`);
  }
  if (after.siteId !== undefined && after.siteId !== before.siteId) {
    changes.push('Site changed');
  }
  if (after.requestDate !== undefined) {
    const prev = before.requestDate?.toISOString().slice(0, 10);
    if (after.requestDate.slice(0, 10) !== prev) {
      changes.push(`Pick-up date → ${after.requestDate.slice(0, 10)}`);
    }
  }
  return changes;
}
