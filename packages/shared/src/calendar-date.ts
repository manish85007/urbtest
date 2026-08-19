/** Local calendar YYYY-MM-DD (avoids UTC-offset shifting the civil date). */
export function localYmd(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isPastCalendarDate(ymd: string, now: Date = new Date()): boolean {
  const day = ymd.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < localYmd(now);
}
