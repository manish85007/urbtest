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
 * Earliest date Super Admin may use when uploading historical FY lifecycle data
 * (request, vehicle, weighment, invoice, payment, MRN, Form 6, CoD).
 * Normal users remain limited by each field's day-to-day rules.
 */
export const HISTORICAL_REQUEST_FROM = '2026-04-01';
/** Alias — historical backdate applies to the full lifecycle, not only requests. */
export const HISTORICAL_BACKDATE_FROM = HISTORICAL_REQUEST_FROM;

export type LifecycleDatePolicy = {
  /** Super Admin historical upload window from HISTORICAL_BACKDATE_FROM. */
  allowHistoricalBackdate: boolean;
  /** When true, dates after today are allowed (pickup scheduling). Default false. */
  allowFuture?: boolean;
  /**
   * When false, non-backdate actors cannot choose a date before today.
   * When true (default), they may use any past date (still blocked from the future unless allowFuture).
   */
  allowPastWithoutBackdate?: boolean;
};

/** Earliest selectable calendar day for the given policy (empty string = no min). */
export function earliestLifecycleDate(policy: LifecycleDatePolicy, now: Date = new Date()): string {
  const today = localYmd(now);
  if (policy.allowHistoricalBackdate) {
    return HISTORICAL_BACKDATE_FROM < today ? HISTORICAL_BACKDATE_FROM : today;
  }
  if (policy.allowPastWithoutBackdate === false) return today;
  return '';
}

/** @deprecated Prefer earliestLifecycleDate — kept for existing request UI. */
export function earliestRequestDate(allowHistoricalBackdate: boolean, now: Date = new Date()): string {
  return earliestLifecycleDate(
    { allowHistoricalBackdate, allowFuture: true, allowPastWithoutBackdate: false },
    now,
  );
}

/** Returns an error message when the date is not allowed; otherwise null. */
export function lifecycleDateError(
  ymd: string,
  label: string,
  policy: LifecycleDatePolicy,
  now: Date = new Date(),
): string | null {
  const day = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return `${label} is required.`;

  const today = localYmd(now);
  const allowFuture = policy.allowFuture === true;
  const allowPastFree = policy.allowPastWithoutBackdate !== false;

  if (!allowFuture && day > today) {
    return `${label} cannot be a future date.`;
  }

  if (policy.allowHistoricalBackdate) {
    if (day < HISTORICAL_BACKDATE_FROM) {
      return `${label} cannot be before ${HISTORICAL_BACKDATE_FROM} (historical upload window).`;
    }
    return null;
  }

  if (!allowPastFree && day < today) {
    return allowFuture
      ? `${label} cannot be in the past. Choose today or a future date.`
      : `${label} cannot be in the past.`;
  }

  return null;
}

/** Pick-up request date: future OK; past only for Super Admin historical upload. */
export function requestDateError(
  ymd: string,
  allowHistoricalBackdate: boolean,
  now: Date = new Date(),
): string | null {
  return lifecycleDateError(
    ymd,
    'Pick-up request date',
    { allowHistoricalBackdate, allowFuture: true, allowPastWithoutBackdate: false },
    now,
  );
}
