import { formatINR } from '@urb-tectrack/shared';

export interface PendingPayment {
  invoiceNo: string;
  requestId: string;
  clientName: string;
  dueDate: string;
  overdueDays: number;
  totalPaise: number;
  duePaise: number;
}

export interface PaymentDigest {
  count: number;
  totalDuePaise: number;
  totalOutstanding: string;
  invoiceList: string;
}

/**
 * Formats the Super Admin reminder for invoices that are overdue with no payment
 * recorded. Most overdue first, so the top of the mail is the most urgent.
 */
export function buildPaymentDigest(pending: PendingPayment[]): PaymentDigest {
  const rows = [...pending].sort(
    (a, b) => b.overdueDays - a.overdueDays || b.duePaise - a.duePaise,
  );
  const totalDuePaise = rows.reduce((sum, r) => sum + r.duePaise, 0);

  const invoiceList = rows
    .map(
      (r) =>
        `  • ${r.invoiceNo} — ${r.clientName} (${r.requestId})\n` +
        `      ${formatINR(r.duePaise)} of ${formatINR(r.totalPaise)} outstanding · due ${r.dueDate}` +
        ` · ${r.overdueDays} day${r.overdueDays === 1 ? '' : 's'} overdue`,
    )
    .join('\n');

  return {
    count: rows.length,
    totalDuePaise,
    totalOutstanding: formatINR(totalDuePaise),
    invoiceList,
  };
}
