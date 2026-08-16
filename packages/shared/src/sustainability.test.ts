import { describe, expect, it } from 'vitest';
import { computeImpact, heroProgress, sequestered, treesEarned } from './sustainability.js';
import { inFiscalYear, getFY } from './fiscal-year.js';

describe('sustainability', () => {
  it('computes impact from recycled kg', () => {
    const impact = computeImpact(1000, 2, 1);
    expect(impact.tonnes).toBe(1);
    expect(impact.co2).toBe(1440);
    expect(treesEarned(1)).toBe(1);
  });

  it('accrues sequestration from planting date', () => {
    const plantedAt = new Date('2026-08-01T00:00:00Z');
    const asOf = new Date('2026-08-11T00:00:00Z');
    const seq = sequestered([{ trees: 2, plantedAt }], asOf);
    expect(seq.treeDays).toBe(20);
    expect(seq.perDay).toBeCloseTo((22 / 365) * 2);
    expect(seq.kg).toBeCloseTo((22 / 365) * 20);
  });

  it('unlocks a badge every 10 trees earned', () => {
    const p = heroProgress(23);
    expect(p.badge).toBe(20);
    expect(p.nextBadge).toBe(30);
    expect(p.toNext).toBe(7);
    expect(p.badges.filter((b) => b.unlocked).map((b) => b.n)).toEqual([10, 20]);
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
