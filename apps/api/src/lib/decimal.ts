export function toKg(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
