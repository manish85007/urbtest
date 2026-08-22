/** Shared date/time helpers for form controls (local calendar, ISO for API). */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today as YYYY-MM-DD in local timezone. */
export function localDateIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Split an ISO or datetime string into local date + HH:mm for pickers. */
export function splitDateTime(value?: string | null): { date: string; time: string } {
  if (!value) return { date: '', time: '09:00' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);
    if (m) return { date: m[1], time: m[2] ?? '09:00' };
    return { date: '', time: '09:00' };
  }
  return {
    date: localDateIso(d),
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** Combine local date + time to ISO string for the API. */
export function combineDateTime(date: string, time: string): string {
  if (!date) return '';
  const t = time || '09:00';
  const d = new Date(`${date}T${t}:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Human-readable preview for date+time pickers. */
export function formatDateTimePreview(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Human-readable preview for date-only fields. */
export function formatDatePreview(value?: string | null): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Round time to nearest 15 minutes (for sensible defaults). */
export function defaultPickupTime(d = new Date()): string {
  const mins = d.getHours() * 60 + d.getMinutes();
  const rounded = Math.ceil(mins / 15) * 15;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function defaultDateTimeValue(d = new Date()): string {
  return combineDateTime(localDateIso(d), defaultPickupTime(d));
}
