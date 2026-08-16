export function num(n: number, digits = 2): string {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysBetween(from: string, to = new Date()): number {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86_400_000));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
