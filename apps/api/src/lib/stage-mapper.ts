import { invStage, subStage } from '@urb-tectrack/shared';
import type { SubmissionFull } from './db-helpers.js';

export function deriveSubmissionStage(sub: SubmissionFull): number {
  return subStage({
    acknowledged: !!sub.acknowledgedAt,
    hasVehicles: sub.vehicles.length > 0,
    allVehiclesWeighed: sub.vehicles.length > 0 && sub.vehicles.every((v) => !!v.weighment),
    loadingCompleted: !!sub.loadingCompletedAt,
    invoices: sub.invoices.map((inv) => ({
      closedAt: inv.closedAt,
      hasCertificate: inv.certificates.length > 0,
      hasRecycling: !!inv.recycling,
      hasMrn: !!inv.mrn,
    })),
  });
}

export function deriveInvoiceStage(inv: {
  closedAt: Date | string | null;
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
