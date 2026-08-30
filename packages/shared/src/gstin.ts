/** Indian GSTIN format + check-digit validation (ISO 7064 Mod 36-2). */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function normalizeGstin(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function checkDigit(body14: string): string {
  let factor = 1;
  let sum = 0;
  for (const ch of body14) {
    const code = CHARSET.indexOf(ch);
    if (code < 0) return '';
    let product = code * factor;
    factor = factor === 1 ? 2 : 1;
    product = Math.floor(product / CHARSET.length) + (product % CHARSET.length);
    sum += product;
  }
  const checksum = (CHARSET.length - (sum % CHARSET.length)) % CHARSET.length;
  return CHARSET[checksum] ?? '';
}

/** Returns null when valid; otherwise a short human-readable error. */
export function gstinError(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  if (!gstin) return 'GSTIN is required.';
  if (gstin.length !== 15) return 'GSTIN must be exactly 15 characters.';
  if (!GSTIN_RE.test(gstin)) {
    return 'GSTIN format is invalid (expected 15-character Indian GSTIN).';
  }
  const expected = checkDigit(gstin.slice(0, 14));
  if (!expected || expected !== gstin[14]) {
    return 'GSTIN check digit is invalid. Double-check the number.';
  }
  return null;
}

export function isValidGstin(raw: string): boolean {
  return gstinError(raw) === null;
}

/** PAN embedded in a valid GSTIN (characters 3–12). */
export function panFromGstin(raw: string): string | null {
  const gstin = normalizeGstin(raw);
  if (!isValidGstin(gstin)) return null;
  return gstin.slice(2, 12);
}
