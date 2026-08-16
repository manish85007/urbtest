import { formatINR } from './money.js';

export type PayStatusKey = 'pending' | 'partial' | 'paid';

export interface PayStatus {
  key: PayStatusKey;
  label: string;
  paidPaise: bigint;
  totalPaise: bigint;
  duePaise: bigint;
}

export function sumPaise(amounts: bigint[]): bigint {
  return amounts.reduce((sum, n) => sum + n, 0n);
}

export function getPayStatus(totalPaise: bigint, paidPaise: bigint): PayStatus {
  const duePaise = totalPaise - paidPaise;
  if (paidPaise <= 0n) {
    return { key: 'pending', label: 'Pending', paidPaise, totalPaise, duePaise };
  }
  if (paidPaise + 1n < totalPaise) {
    const pct = totalPaise > 0n ? Number((paidPaise * 100n) / totalPaise) : 0;
    return {
      key: 'partial',
      label: `Partial (${pct}%)`,
      paidPaise,
      totalPaise,
      duePaise,
    };
  }
  return { key: 'paid', label: 'Paid', paidPaise, totalPaise, duePaise: 0n };
}

export function unpaidCloseMessage(invoiceNo: string, duePaise: bigint, totalPaise: bigint): string {
  return `Payment is not settled on ${invoiceNo} — ${formatINR(Number(duePaise))} of ${formatINR(Number(totalPaise))} is still outstanding. The invoice must be fully paid before this request can be closed.`;
}
