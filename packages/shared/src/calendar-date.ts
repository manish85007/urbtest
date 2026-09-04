/** Local calendar YYYY-MM-DD (avoids UTC-offset shifting the civil date). */
export function localYmd(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isPastCalendarDate(ymd: string, now: Date = new Date()): boolean {
  const day = ymd.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < localYmd(now);
}

/**
 * Earliest pick-up date Super Admin may use when uploading historical FY data.
 * Normal users remain limited to today onward.
 */
export const HISTORICAL_REQUEST_FROM = '2026-04-01';

export function earliestRequestDate(allowHistoricalBackdate: boolean, now: Date = new Date()): string {
  const today = localYmd(now);
  if (!allowHistoricalBackdate) return today;
  return HISTORICAL_REQUEST_FROM < today ? HISTORICAL_REQUEST_FROM : today;
}

/** Returns an error message when the pick-up date is not allowed; otherwise null. */
export function requestDateError(
  ymd: string,
  allowHistoricalBackdate: boolean,
  now: Date = new Date(),
): string | null {
  const day = ymd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Pick-up request date is invalid.';
  const min = earliestRequestDate(allowHistoricalBackdate, now);
  if (day < min) {
    return allowHistoricalBackdate
      ? `Pick-up request date cannot be before ${HISTORICAL_REQUEST_FROM} (historical upload window).`
      : 'Pick-up request date cannot be in the past. Choose today or a future date.';
  }
  return null;
}
