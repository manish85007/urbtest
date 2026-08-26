import { invStage, subStage } from '@urb-tectrack/shared';
import type { SubmissionFull } from './db-helpers.js';

function recyclingApproved(recycling: { reviewStatus?: string } | null | undefined): boolean {
  return !!recycling && recycling.reviewStatus === 'approved';
}

export { recyclingApproved };

export function deriveSubmissionStage(sub: SubmissionFull): number {
  return subStage({
    acknowledged: !!sub.acknowledgedAt,
    hasVehicles: sub.vehicles.length > 0,
    allVehiclesWeighed: sub.vehicles.length > 0 && sub.vehicles.every((v) => !!v.weighment),
    loadingCompleted: !!sub.loadingCompletedAt,
    invoices: sub.invoices.map((inv) => ({
      closedAt: inv.closedAt,
      hasCertificate: inv.certificates.length > 0,
      hasRecycling: recyclingApproved(inv.recycling),
      hasMrn: !!inv.mrn,
    })),
  });
}

export function deriveInvoiceStage(inv: {
  closedAt: Date | string | null;
  certificates: unknown[];
  recycling: { reviewStatus?: string } | null;
  mrn: unknown | null;
}): number {
  return invStage({
    closedAt: inv.closedAt,
    hasCertificate: inv.certificates.length > 0,
    hasRecycling: recyclingApproved(inv.recycling),
    hasMrn: !!inv.mrn,
  });
}

export function withDerivedStages(sub: SubmissionFull) {
  return {
    ...sub,
    derivedStage: deriveSubmissionStage(sub),
    invoices: sub.invoices.map((inv) => ({
      ...inv,
      derivedStage: deriveInvoiceStage(inv),
      /** Preserved for clients after MRN redaction (R4). */
      hasMrn: !!inv.mrn,
    })),
  };
}
