import { localYmd } from '@urb-tectrack/shared';

/** Use en-US so September is "Sep" (en-IN / en-GB yield "Sept"). */
const DATE_LOCALE = 'en-US';

export function num(n: number, digits = 2): string {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Fixed 2-decimal kg display for weighment / material tables. */
export function kg(n: number): string {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Capacity / utilization % — always one decimal for cross-page consistency. */
export function pct1(n: number): string {
  return `${Number(n || 0).toFixed(1)}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString(DATE_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtTS(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString(DATE_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysBetween(from: string, to = new Date()): number {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86_400_000));
}

export function todayIso(): string {
  return localYmd();
}

/** User-facing site / factory codes — drop underscores (QLCM_NOIDA → QLCMNOIDA). */
export function displayCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).replace(/_/g, '');
}
