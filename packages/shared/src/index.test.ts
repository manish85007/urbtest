import { describe, expect, it } from 'vitest';
import { getFY, formatMrnNumber, formatForm6Number } from './fiscal-year.js';
import { invStage, subStage, viewPhaseForStage } from './stage.js';
import { deriveTax, rupeesToPaise } from './money.js';
import { recoveryFor, weightsBalance } from './recovery.js';
import { formatE164, isValidNational10, national10 } from './phone.js';
import { isPastCalendarDate, localYmd, requestDateError, HISTORICAL_REQUEST_FROM } from './calendar-date.js';

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

  it('groups derived stages into five request-page phases', () => {
    expect(viewPhaseForStage(1)).toBe(1);
    expect(viewPhaseForStage(2)).toBe(1);
    expect(viewPhaseForStage(3)).toBe(2);
    expect(viewPhaseForStage(4)).toBe(2);
    expect(viewPhaseForStage(5)).toBe(3);
    expect(viewPhaseForStage(6)).toBe(3);
    expect(viewPhaseForStage(7)).toBe(4);
    expect(viewPhaseForStage(8)).toBe(4);
    expect(viewPhaseForStage(9)).toBe(5);
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

describe('pick-up calendar date', () => {
  it('treats earlier calendar days as past and today as allowed', () => {
    const now = new Date(2026, 7, 19, 15, 0, 0);
    expect(localYmd(now)).toBe('2026-08-19');
    expect(isPastCalendarDate('2026-08-18', now)).toBe(true);
    expect(isPastCalendarDate('2026-08-19', now)).toBe(false);
    expect(isPastCalendarDate('2026-08-20', now)).toBe(false);
  });

  it('allows Super Admin historical backdate from 1 Apr 2026', () => {
    const now = new Date(2026, 8, 4, 12, 0, 0);
    expect(requestDateError('2026-04-01', true, now)).toBeNull();
    expect(requestDateError('2026-05-15', true, now)).toBeNull();
    expect(requestDateError('2026-03-31', true, now)).toMatch(/before/);
    expect(requestDateError('2026-08-18', false, now)).toMatch(/past/);
    expect(HISTORICAL_REQUEST_FROM).toBe('2026-04-01');
  });
});
