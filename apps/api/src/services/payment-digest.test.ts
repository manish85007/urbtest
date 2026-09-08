import { describe, expect, it } from 'vitest';
import { buildPaymentDigest, type PendingPayment } from './payment-digest.js';

const invoice = (over: Partial<PendingPayment> = {}): PendingPayment => ({
  invoiceNo: 'INV-CL-100001',
  requestId: 'REQ-00101',
  clientName: 'TechCorp Pvt Ltd',
  dueDate: '2026-08-20',
  overdueDays: 3,
  totalPaise: 1180000,
  duePaise: 1180000,
  ...over,
});

describe('buildPaymentDigest', () => {
  it('totals the outstanding amount across invoices', () => {
    const digest = buildPaymentDigest([
      invoice({ duePaise: 1180000 }),
      invoice({ invoiceNo: 'INV-CL-100002', duePaise: 590000 }),
    ]);

    expect(digest.count).toBe(2);
    expect(digest.totalDuePaise).toBe(1770000);
    expect(digest.totalOutstanding).toContain('17,700');
  });

  it('lists the most overdue invoice first', () => {
    const digest = buildPaymentDigest([
      invoice({ invoiceNo: 'INV-NEW', overdueDays: 2 }),
      invoice({ invoiceNo: 'INV-OLD', overdueDays: 45 }),
    ]);

    const lines = digest.invoiceList.split('\n');
    expect(lines[0]).toContain('INV-OLD');
    expect(digest.invoiceList.indexOf('INV-OLD')).toBeLessThan(
      digest.invoiceList.indexOf('INV-NEW'),
    );
  });

  it('shows the client, request and part payment on each line', () => {
    const digest = buildPaymentDigest([
      invoice({ totalPaise: 1180000, duePaise: 180000, overdueDays: 1 }),
    ]);

    expect(digest.invoiceList).toContain('INV-CL-100001');
    expect(digest.invoiceList).toContain('TechCorp Pvt Ltd');
    expect(digest.invoiceList).toContain('REQ-00101');
    expect(digest.invoiceList).toContain('due 2026-08-20');
    expect(digest.invoiceList).toContain('1 day overdue');
  });

  it('pluralises the overdue day count', () => {
    expect(buildPaymentDigest([invoice({ overdueDays: 12 })]).invoiceList).toContain(
      '12 days overdue',
    );
  });

  it('handles an empty list', () => {
    const digest = buildPaymentDigest([]);
    expect(digest.count).toBe(0);
    expect(digest.totalDuePaise).toBe(0);
    expect(digest.invoiceList).toBe('');
  });
});
