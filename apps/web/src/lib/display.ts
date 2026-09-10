/** Re-export shared place formatter for web callers. */
export { titleCasePlace } from '@urb-tectrack/shared';

/** Natural sort for alphanumeric IDs (CEEW2 before CEEW10). */
export function naturalCompare(a: string, b: string): number {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function naturalSortBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((x, y) => naturalCompare(key(x), key(y)));
}

const DETAIL_KEY_LABELS: Record<string, string> = {
  attempts: 'Consecutive failures',
  to: 'Recipients',
  subject: 'Subject',
  templateKey: 'Template',
  via: 'Via',
  name: 'File',
  reason: 'Reason',
  method: 'Method',
  ip: 'IP',
  userAgent: 'Browser',
  path: 'Path',
  status: 'Status',
  invoiceNo: 'Invoice',
  requestNo: 'Request',
};

/** Human-readable audit/security detail column (no raw JSON). */
export function formatDetailObject(details: unknown): string {
  if (details == null) return '—';
  if (typeof details === 'string') {
    const t = details.trim();
    if (!t || t === '{}' || t === '[]') return '—';
    try {
      return formatDetailObject(JSON.parse(t));
    } catch {
      return t;
    }
  }
  if (typeof details !== 'object') return String(details);
  if (Array.isArray(details)) {
    if (!details.length) return '—';
    return details.map((x) => formatDetailObject(x)).join('; ');
  }
  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return '—';

  const labelKey = (k: string) =>
    DETAIL_KEY_LABELS[k] ??
    k
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const labelVal = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) {
      if (!v.length) return '—';
      return v.map((x) => labelVal(x)).join(', ');
    }
    if (typeof v === 'object') return formatDetailObject(v);
    const s = String(v);
    if (s === 'email') return 'Email';
    if (s === 'totp') return 'Authenticator';
    if (s === 'signed-url') return 'Signed URL';
    return s;
  };

  return entries
    .filter(([k, v]) => !(k === 'attempts' && (v === 0 || v === '0')))
    .map(([k, v]) => `${labelKey(k)}: ${labelVal(v)}`)
    .join(' · ');
}
