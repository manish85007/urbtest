import { describe, expect, it } from 'vitest';
import { computeImpact, treesEarned } from './sustainability.js';
import { inFiscalYear, getFY } from './fiscal-year.js';

describe('sustainability', () => {
  it('computes impact from recycled kg', () => {
    const impact = computeImpact(1000, 2, 1);
    expect(impact.tonnes).toBe(1);
    expect(impact.co2).toBe(1440);
    expect(treesEarned(1)).toBe(1);
  });
});

describe('inFiscalYear', () => {
  it('matches FY label for April boundary', () => {
    const fy = getFY(new Date('2026-05-01'));
    expect(fy?.label).toBe('FY 2026-27');
    expect(inFiscalYear(new Date('2026-08-01'), 'FY 2026-27')).toBe(true);
    expect(inFiscalYear(new Date('2026-02-01'), 'FY 2026-27')).toBe(false);
  });
});
