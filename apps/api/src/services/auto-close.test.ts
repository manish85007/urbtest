import { describe, expect, it } from 'vitest';
import { AUTO_CLOSE_DAYS, isEligibleForAutoClose } from './auto-close.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

describe('isEligibleForAutoClose', () => {
  const base = {
    closedAt: null as Date | null,
    clientPublishedAt: day(1),
    firstCertAt: day(1),
    totalPaise: 118_000n,
    paidPaise: 118_000n,
    now: day(1 + AUTO_CLOSE_DAYS),
  };

  it('closes when certified, paid and past the day threshold', () => {
    expect(isEligibleForAutoClose(base)).toBe(true);
  });

  it('refuses an already-closed invoice', () => {
    expect(isEligibleForAutoClose({ ...base, closedAt: day(10) })).toBe(false);
  });

  it('refuses when Form 6 / CoD are not published to the client', () => {
    expect(isEligibleForAutoClose({ ...base, clientPublishedAt: null })).toBe(false);
  });

  it('refuses before day 60', () => {
    expect(
      isEligibleForAutoClose({
        ...base,
        now: day(1 + AUTO_CLOSE_DAYS - 1),
      }),
    ).toBe(false);
  });

  it('refuses unpaid invoices (C6)', () => {
    expect(isEligibleForAutoClose({ ...base, paidPaise: 0n })).toBe(false);
  });

  it('refuses when there is no certificate', () => {
    expect(isEligibleForAutoClose({ ...base, firstCertAt: null })).toBe(false);
  });
});
