import type { FiscalYear } from '@urb-tectrack/shared';

export interface CategoryCapacityCheck {
  entryId: string;
  addKg: number;
  usedKg: number;
  capKg: number;
  projectedKg: number;
  pct: number;
  exceeds: boolean;
  warn: boolean;
}

export function capacityKgFromTpa(capacityTpa: number): number {
  return capacityTpa * 1000;
}

export function checkCategoryCapacity(
  usedKg: number,
  addKg: number,
  capacityTpa: number,
): CategoryCapacityCheck {
  const capKg = capacityKgFromTpa(capacityTpa);
  const projectedKg = usedKg + addKg;
  const pct = capKg > 0 ? (projectedKg / capKg) * 100 : 0;
  const exceeds = capKg > 0 && projectedKg > capKg;
  const warn = capKg > 0 && !exceeds && pct >= 80;
  return {
    entryId: '',
    addKg,
    usedKg,
    capKg,
    projectedKg,
    pct,
    exceeds,
    warn,
  };
}

export function capacityExceedMessage(entryId: string, check: CategoryCapacityCheck): string {
  return `${entryId} — adding ${check.addKg} kg takes YTD to ${check.projectedKg} kg, EXCEEDING the authorized ${check.capKg} kg (${check.pct.toFixed(1)}%). Record an authorized override reason to proceed.`;
}

/** Inclusive FY window for utilization queries (April 1 → March 31). */
export function fiscalYearBounds(fy: FiscalYear): { start: Date; end: Date } {
  return {
    start: new Date(fy.start, 3, 1),
    end: new Date(fy.end, 2, 31, 23, 59, 59, 999),
  };
}
