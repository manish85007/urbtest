import { describe, expect, it } from 'vitest';
import { mergeTemplate } from './email-merge.js';
import { invoiceDue, paymentTermsLabel } from './invoice-due.js';
import { recyclingSla, SLA_LABEL } from './recycling-sla.js';

describe('mergeTemplate', () => {
  it('replaces known vars and leaves unknown placeholders', () => {
    expect(mergeTemplate('Hello {{name}} — {{missing}}', { name: 'Manish' })).toBe(
      'Hello Manish — {{missing}}',
    );
  });
});

describe('invoiceDue', () => {
  it('marks invoice overdue after pay terms elapse', () => {
    const due = invoiceDue(new Date('2026-01-01'), 30, new Date('2026-02-05'));
    expect(due.isOverdue).toBe(true);
    expect(due.overdue).toBe(5);
    expect(paymentTermsLabel(30)).toBe('Net 30 days');
  });
});

describe('recyclingSla', () => {
  it('warns when 80% of SLA window is used', () => {
    const sla = recyclingSla({
      mrnReceivedAt: new Date('2026-01-01'),
      slaDays: 30,
      warnAtPct: 0.8,
      now: new Date('2026-01-25'),
    });
    expect(sla?.state).toBe('warn');
    expect(SLA_LABEL.warn).toBe('Due soon');
  });

  it('returns null input handling when mrn missing is handled by caller', () => {
    const sla = recyclingSla({
      mrnReceivedAt: new Date('2026-01-01'),
      certificateAt: new Date('2026-01-10'),
      slaDays: 30,
    });
    expect(sla?.state).toBe('met');
  });
});
