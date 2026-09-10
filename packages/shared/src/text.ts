/** Title-case a city/place name for consistent storage and display. */
export function titleCasePlace(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/** Title-case org / contact names stored in ALL CAPS; leave mixed-case alone. */
export function titleCaseName(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return s;
  if (letters !== letters.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(/(\s+|\/|-|&)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '/' || part === '-') return part;
      if (part === '&') return '&';
      if (part === 'r' || part === 'd') return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('')
    .replace(/\bR\s*&\s*D\b/gi, 'R&D')
    .replace(/\bPvt\b/g, 'Pvt')
    .replace(/\bLtd\b/g, 'Ltd');
}
