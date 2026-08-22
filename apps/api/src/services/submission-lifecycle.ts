import type { Prisma } from '@prisma/client';
import type { SessionUser } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';

export type SubmissionLifecycleEventKind =
  | 'created'
  | 'returned'
  | 'resubmitted'
  | 'acknowledged'
  | 'loading_complete';

const EVENT_LABELS: Record<SubmissionLifecycleEventKind, string> = {
  created: 'Request raised',
  returned: 'Returned to requestor',
  resubmitted: 'Requestor resubmitted',
  acknowledged: 'Acknowledged by Urbeno',
  loading_complete: 'Loading complete',
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
      details: (details ?? {}) as Prisma.InputJsonValue,
    },
  });
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
