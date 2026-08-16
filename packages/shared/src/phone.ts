/** Indian mobile numbers: country code + frozen 10-digit national number. */

export const DEFAULT_COUNTRY_CODE = '91';

export const COUNTRY_CODES = [
  { cc: '91', label: '+91', name: 'India' },
  { cc: '1', label: '+1', name: 'US / Canada' },
  { cc: '44', label: '+44', name: 'UK' },
  { cc: '971', label: '+971', name: 'UAE' },
  { cc: '65', label: '+65', name: 'Singapore' },
] as const;

export function digitsOnly(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Last 10 digits, stripping a leading 91 / 0 when present. */
export function national10(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length >= 12 && d.startsWith('91')) return d.slice(-10);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d.slice(-10);
}

export function countryCodeOf(raw: string, fallback = DEFAULT_COUNTRY_CODE): string {
  const d = digitsOnly(raw);
  if (d.length >= 12 && d.startsWith('91')) return '91';
  for (const row of COUNTRY_CODES) {
    if (row.cc !== '91' && d.startsWith(row.cc) && d.length === row.cc.length + 10) return row.cc;
  }
  return fallback;
}

export function formatE164(national: string, cc = DEFAULT_COUNTRY_CODE): string {
  const n = digitsOnly(national).slice(-10);
  return n ? `+${cc}${n}` : '';
}

export function isValidNational10(raw: string): boolean {
  return /^\d{10}$/.test(national10(raw)) && national10(raw).length === 10;
}

export function splitPhone(raw: string): { cc: string; national: string } {
  return { cc: countryCodeOf(raw), national: national10(raw) };
}
