import { earliestLifecycleDate, HISTORICAL_BACKDATE_FROM, type LifecycleDatePolicy } from '@urb-tectrack/shared';
import { localDateIso } from './datetime';

/** Policy for pickup scheduling dates (request / vehicle expected) — future allowed. */
export function scheduleDatePolicy(canBackdate: boolean): LifecycleDatePolicy {
  return {
    allowHistoricalBackdate: canBackdate,
    allowFuture: true,
    allowPastWithoutBackdate: false,
  };
}

/** Policy for recorded operational dates (invoice, payment, MRN, Form 6, CoD). */
export function recordedDatePolicy(canBackdate: boolean): LifecycleDatePolicy {
  return {
    allowHistoricalBackdate: canBackdate,
    allowFuture: false,
    allowPastWithoutBackdate: true,
  };
}

/** Policy for weighment — non-admin today only; Super Admin historical window. */
export function weighmentDatePolicy(canBackdate: boolean): LifecycleDatePolicy {
  return {
    allowHistoricalBackdate: canBackdate,
    allowFuture: false,
    allowPastWithoutBackdate: false,
  };
}

export function lifecycleMinDate(policy: LifecycleDatePolicy): string | undefined {
  const min = earliestLifecycleDate(policy);
  return min || undefined;
}

export function lifecycleMaxDate(policy: LifecycleDatePolicy): string | undefined {
  if (policy.allowFuture) return undefined;
  return localDateIso();
}

export function historicalBackdateHint(canBackdate: boolean): string | undefined {
  if (!canBackdate) return undefined;
  return `Super Admin historical upload: dates from ${HISTORICAL_BACKDATE_FROM} are allowed.`;
}
