/**
 * Stage derivation — ported from prototype invStage() / subStage().
 * Stage is NEVER stored as source of truth; always derived from records.
 */

export interface InvoiceStageInput {
  closedAt?: string | Date | null;
  hasCertificate?: boolean;
  hasRecycling?: boolean;
  hasMrn?: boolean;
}

export interface SubmissionStageInput {
  invoices?: InvoiceStageInput[];
  acknowledged?: boolean;
  allVehiclesWeighed?: boolean;
  hasVehicles?: boolean;
  /** All vehicles weighed and loading acknowledged — unlocks invoicing. */
  loadingCompleted?: boolean;
}

export function invStage(inv: InvoiceStageInput | null | undefined): number {
  if (!inv) return 5;
  if (inv.closedAt) return 9;
  if (inv.hasCertificate) return 8;
  if (inv.hasRecycling) return 7;
  if (inv.hasMrn) return 6;
  return 5;
}

export function subStage(s: SubmissionStageInput | null | undefined): number {
  if (!s) return 1;

  const invoices = s.invoices ?? [];
  if (invoices.length > 0) {
    return Math.min(...invoices.map(invStage));
  }

  if (!s.acknowledged) return 1;
  if (!s.hasVehicles) return 3;
  if (!s.allVehiclesWeighed) return 4;
  if (!s.loadingCompleted) return 4;
  return 5;
}

export function stageLabel(stage: number): string {
  const labels: Record<number, string> = {
    1: 'Request',
    2: 'Acknowledge',
    3: 'Assign Vehicle',
    4: 'Load & Weigh',
    5: 'Awaiting MRN',
    6: 'Awaiting recycling',
    7: 'Form 6 & CoD',
    8: 'Awaiting close',
    9: 'Closed',
  };
  return labels[stage] ?? 'Unknown';
}

/** Staff work-queue bucket for an open request. Closed requests return null. */
export type WorkQueueKey =
  | 'awaitingAck'
  | 'withRequestor'
  | 'assignVehicle'
  | 'weighment'
  | 'raiseInvoice'
  | 'awaitingMrn'
  | 'awaitingRecycling'
  | 'awaitingCod'
  | 'awaitingClose';

export function workQueueForStage(input: {
  stage: number;
  returned?: boolean;
  /** Least-progressed open invoice stage. Omit when the request has no open invoice. */
  blockingInvoiceStage?: number | null;
  /** Certificate file exists on the blocking invoice. Omit when unknown. */
  codUploaded?: boolean;
  allVehiclesWeighed?: boolean;
  loadingCompleted?: boolean;
}): { key: WorkQueueKey; statusLabel: string } | null {
  if (input.stage >= 9) return null;
  if (input.stage <= 2) {
    return input.returned
      ? { key: 'withRequestor', statusLabel: 'Returned to requestor' }
      : { key: 'awaitingAck', statusLabel: 'Awaiting acknowledgement' };
  }
  if (input.stage === 3) return { key: 'assignVehicle', statusLabel: 'Assign vehicle' };
  if (input.stage === 4) {
    return {
      key: 'weighment',
      statusLabel:
        input.allVehiclesWeighed && !input.loadingCompleted ? 'Complete loading' : 'Weigh vehicles',
    };
  }

  const blocking = input.blockingInvoiceStage;
  if (blocking == null || blocking >= 9) {
    return { key: 'raiseInvoice', statusLabel: 'Ready to invoice' };
  }
  if (blocking <= 5) return { key: 'awaitingMrn', statusLabel: 'Awaiting MRN' };
  if (blocking === 6) return { key: 'awaitingRecycling', statusLabel: 'Awaiting recycling' };
  if (blocking === 7) {
    const statusLabel =
      input.codUploaded === true
        ? 'Certify & publish CoD'
        : input.codUploaded === false
          ? 'Upload CoD'
          : 'Form 6 & CoD';
    return { key: 'awaitingCod', statusLabel };
  }
  return { key: 'awaitingClose', statusLabel: 'Awaiting client close' };
}

/** Next-step label for a request. Prefers the work-queue wording over the collapsed phase name. */
export function requestStatusLabel(
  stage: number,
  opts?: {
    returned?: boolean;
    invoiceCount?: number;
    blockingInvoiceStage?: number | null;
    codUploaded?: boolean;
    allVehiclesWeighed?: boolean;
    loadingCompleted?: boolean;
  },
): string {
  const queued = workQueueForStage({
    stage,
    returned: opts?.returned,
    blockingInvoiceStage:
      opts?.blockingInvoiceStage !== undefined
        ? opts.blockingInvoiceStage
        : opts?.invoiceCount === 0
          ? null
          : stage >= 5
            ? stage
            : null,
    codUploaded: opts?.codUploaded,
    allVehiclesWeighed: opts?.allVehiclesWeighed,
    loadingCompleted: opts?.loadingCompleted,
  });
  return queued?.statusLabel ?? stageLabel(stage);
}

/** Request-page grouping: nine derived stages shown as five user-facing phases. */
export function viewPhaseForStage(stage: number): number {
  if (stage <= 2) return 1;
  if (stage <= 4) return 2;
  if (stage <= 6) return 3;
  if (stage <= 8) return 4;
  return 5;
}
