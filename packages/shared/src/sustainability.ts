/** Sustainability factors — ported from prototype SUS (EPA WARM v16 / R2v3 / USFS). */
export const SUSTAINABILITY = {
  co2PerKg: 1.44,
  landfillRatio: 0.92,
  co2PerTree: 22,
  co2PerTreeDay: 22 / 365,
  waterPerKg: 0.61,
  energyPerKg: 2.3,
  /** One sapling earned per full tonne of closed e-waste. */
  treesPerTonne: 1,
  /** Years Urbeno nurtures each sapling toward self-reliance. */
  nurtureYears: 3,
  heroMilestone: 10,
  cite: {
    co2: 'US EPA WARM model v16 (2023), mixed-electronics pathway',
    landfill: 'R2v3 downstream recovery tracking, industry average',
    tree: 'US Forest Service, urban tree CO2 sequestration',
    water: 'UNEP Global E-waste Monitor 2024, virgin baseline',
    energy: 'UNEP Global E-waste Monitor 2024, virgin baseline',
    sapling: 'Urbeno Recycling Heroes — 1 sapling per tonne, nurtured for 3 years',
  },
} as const;

export interface ImpactMetrics {
  kg: number;
  tonnes: number;
  co2: number;
  landfill: number;
  trees: number;
  water: number;
  energy: number;
  invoices: number;
  submissions: number;
}

export function computeImpact(kg: number, invoiceCount: number, submissionCount: number): ImpactMetrics {
  const co2 = kg * SUSTAINABILITY.co2PerKg;
  return {
    kg,
    tonnes: kg / 1000,
    co2,
    landfill: kg * SUSTAINABILITY.landfillRatio,
    trees: co2 / SUSTAINABILITY.co2PerTree,
    water: kg * SUSTAINABILITY.waterPerKg,
    energy: kg * SUSTAINABILITY.energyPerKg,
    invoices: invoiceCount,
    submissions: submissionCount,
  };
}

export function treesEarned(tonnes: number): number {
  return Math.floor(tonnes * SUSTAINABILITY.treesPerTonne);
}

export interface Sequestered {
  kg: number;
  treeDays: number;
  perDay: number;
}

/** CO₂ actually sequestered so far — accrues daily from each planting date. */
export function sequestered(
  plantings: Array<{ trees: number; plantedAt: Date | string }>,
  asOf = new Date(),
): Sequestered {
  let kg = 0;
  let treeDays = 0;
  let standing = 0;
  for (const t of plantings) {
    const planted = t.plantedAt instanceof Date ? t.plantedAt : new Date(t.plantedAt);
    const days = Math.max(0, Math.floor((asOf.getTime() - planted.getTime()) / 86_400_000));
    treeDays += days * t.trees;
    kg += days * t.trees * SUSTAINABILITY.co2PerTreeDay;
    standing += t.trees;
  }
  return { kg, treeDays, perDay: standing * SUSTAINABILITY.co2PerTreeDay };
}

export interface HeroBadge {
  n: number;
  unlocked: boolean;
}

export interface HeroProgress {
  badge: number;
  nextBadge: number;
  toNext: number;
  pctToNext: number;
  badges: HeroBadge[];
}

/** Milestone badges every `heroMilestone` trees, based on lifetime trees earned. */
export function heroProgress(earnedAll: number): HeroProgress {
  const m = SUSTAINABILITY.heroMilestone;
  const badge = Math.floor(earnedAll / m) * m;
  const nextBadge = badge + m;
  const count = Math.min(8, Math.max(5, Math.floor(earnedAll / m) + 3));
  return {
    badge,
    nextBadge,
    toNext: Math.max(0, nextBadge - earnedAll),
    pctToNext: ((earnedAll % m) / m) * 100,
    badges: Array.from({ length: count }, (_, i) => ({
      n: (i + 1) * m,
      unlocked: earnedAll >= (i + 1) * m,
    })),
  };
}
