import { currentFY, inFiscalYear } from './fiscal-year.js';

export type ReportPeriodKind = 'fy' | 'calendar' | 'custom' | 'all';

export interface ReportPeriod {
  kind: ReportPeriodKind;
  fy?: string;
  year?: number;
  from?: string;
  to?: string;
}

export function parseReportPeriod(input: {
  period?: string;
  fy?: string;
  year?: string;
  from?: string;
  to?: string;
}): ReportPeriod {
  const kind = (input.period ?? 'fy') as ReportPeriodKind;
  if (kind === 'calendar') {
    const year = input.year ? Number(input.year) : new Date().getFullYear();
    return { kind, year: Number.isFinite(year) ? year : new Date().getFullYear() };
  }
  if (kind === 'custom') {
    return { kind, from: input.from, to: input.to };
  }
  if (kind === 'all') return { kind: 'all' };
  return { kind: 'fy', fy: input.fy || currentFY()?.label || '' };
}

export function dateInPeriod(date: Date, period: ReportPeriod): boolean {
  if (period.kind === 'all') return true;
  if (period.kind === 'fy') {
    return inFiscalYear(date, period.fy || currentFY()?.label || '');
  }
  if (period.kind === 'calendar') {
    return date.getFullYear() === (period.year ?? new Date().getFullYear());
  }
  const from = period.from ? new Date(period.from) : null;
  const to = period.to ? new Date(`${period.to}T23:59:59`) : null;
  if (from && !Number.isNaN(from.getTime()) && date < from) return false;
  if (to && !Number.isNaN(to.getTime()) && date > to) return false;
  return true;
}

export function periodLabel(period: ReportPeriod): string {
  if (period.kind === 'all') return 'All time';
  if (period.kind === 'calendar') return `Calendar ${period.year}`;
  if (period.kind === 'custom') {
    return `${period.from || '…'} → ${period.to || '…'}`;
  }
  return period.fy || currentFY()?.label || 'Current FY';
}
