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
  if (s.allVehiclesWeighed) return 5;
  return 4;
}

export function stageLabel(stage: number): string {
  const labels: Record<number, string> = {
    1: 'Request',
    2: 'Acknowledge',
    3: 'Assign Vehicle',
    4: 'Load & Weigh',
    5: 'Billing',
    6: 'MRN',
    7: 'Recycling',
    8: 'CoD Upload',
    9: 'Closed',
  };
  return labels[stage] ?? 'Unknown';
}
