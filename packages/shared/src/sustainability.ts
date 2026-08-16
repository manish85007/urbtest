/** Sustainability factors — ported from prototype SUS (EPA WARM v16 / R2v3 / USFS). */
export const SUSTAINABILITY = {
  co2PerKg: 1.44,
  landfillRatio: 0.92,
  co2PerTree: 22,
  waterPerKg: 0.61,
  energyPerKg: 2.3,
  treesPerTonne: 1,
  cite: {
    co2: 'US EPA WARM model v16 (2023), mixed-electronics pathway',
    landfill: 'R2v3 downstream recovery tracking, industry average',
    tree: 'US Forest Service, urban tree CO2 sequestration',
    water: 'UNEP Global E-waste Monitor 2024, virgin baseline',
    energy: 'UNEP Global E-waste Monitor 2024, virgin baseline',
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
