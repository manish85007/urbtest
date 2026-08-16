function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((end - start) / 86_400_000);
}

export interface InvoiceDueInfo {
  payTermsDays: number;
  dueDate: string;
  overdue: number;
  isOverdue: boolean;
}

/** Due date and overdue position — ported from prototype invDue(). */
export function invoiceDue(
  invoiceDate: Date,
  payTermsDays: number,
  now: Date = new Date(),
): InvoiceDueInfo {
  const due = new Date(invoiceDate);
  due.setDate(due.getDate() + payTermsDays);
  const overdue = Math.max(0, daysBetween(due, now));
  return {
    payTermsDays,
    dueDate: due.toISOString().slice(0, 10),
    overdue,
    isOverdue: overdue > 0,
  };
}

export function paymentTermsLabel(days: number): string {
  return `Net ${days} days`;
}
