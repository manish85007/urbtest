import { describe, expect, it } from 'vitest';
import { getFY, formatMrnNumber, formatForm6Number } from './fiscal-year.js';
import { invStage, subStage } from './stage.js';
import { deriveTax, rupeesToPaise } from './money.js';
import { recoveryFor, weightsBalance } from './recovery.js';
import { formatE164, isValidNational10, national10 } from './phone.js';

describe('fiscal year', () => {
  it('uses April–March boundaries', () => {
    expect(getFY('2026-03-31')?.short).toBe('2526');
    expect(getFY('2026-04-01')?.short).toBe('2627');
  });

  it('formats MRN numbers', () => {
    expect(formatMrnNumber('URB-BLR', '2627', 1)).toBe('MRN/URB-BLR/2627/0001');
  });

  it('formats Form 6 numbers that reset each April', () => {
    expect(formatForm6Number('2627', 1)).toBe('F6/2627/0001');
    expect(formatForm6Number('2526', 12)).toBe('F6/2526/0012');
  });
});

describe('stage derivation', () => {
  it('derives invoice stage from records', () => {
    expect(invStage({})).toBe(5);
    expect(invStage({ hasMrn: true })).toBe(6);
    expect(invStage({ hasRecycling: true })).toBe(7);
    expect(invStage({ hasCertificate: true })).toBe(8);
    expect(invStage({ closedAt: new Date() })).toBe(9);
  });

  it('submission stage is least advanced invoice', () => {
    expect(
      subStage({
        invoices: [{ hasMrn: true }, { hasRecycling: true, hasCertificate: true }],
      }),
    ).toBe(6);
  });
});

describe('money', () => {
  it('stores paise as integers', () => {
    expect(rupeesToPaise(100.5)).toBe(10050);
    expect(deriveTax(100000, 18)).toBe(18000);
  });
});

describe('recovery', () => {
  it('balances category split', () => {
    const m = recoveryFor('ITEW', 100);
    expect(m.fe + m.nfe + m.pl + m.pcb).toBe(100);
    expect(weightsBalance(100, 100)).toBe(true);
    expect(weightsBalance(100, 99)).toBe(false);
  });
});

describe('phone', () => {
  it('freezes a 10-digit national number with +91', () => {
    expect(national10('9900112233')).toBe('9900112233');
    expect(national10('+91 99001 12233')).toBe('9900112233');
    expect(isValidNational10('9900112233')).toBe(true);
    expect(formatE164('9900112233')).toBe('+919900112233');
    expect(isValidNational10('990011')).toBe(false);
  });
});
