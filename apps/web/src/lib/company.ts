/** Fallback Urbeno contact when Masters company.profile is unavailable. */
export const COMPANY = {
  name: 'Urbeno Private Limited',
  brand: 'Recycling Heroes™',
  email: 'info@urbeno.in',
  /** Prefer Masters → Company & Letterhead; this is only a temporary fallback. */
  phone: '+91 99022 99007',
  phoneTel: '+919902299007',
  wa: '919902299007',
  waUrl: 'https://wa.me/919902299007',
  /** Public certificate pack (TÜV Rheinland) on the corporate site. */
  complianceUrl: 'https://urbeno.in/compliance.php',
  isoCertificates: [
    { code: 'ISO 9001:2015', name: 'Quality Management System' },
    { code: 'ISO 14001:2015', name: 'Environmental Management System' },
    { code: 'ISO 45001:2018', name: 'Occupational Health & Safety' },
    { code: 'ISO/IEC 27001:2022', name: 'Information Security Management' },
  ],
} as const;

export function phoneTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits || COMPANY.phoneTel;
}

export function waMeUrl(wa: string): string {
  const digits = wa.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : COMPANY.waUrl;
}

export function mailtoHref(email: string): string {
  const trimmed = email.trim();
  return trimmed ? `mailto:${trimmed}` : `mailto:${COMPANY.email}`;
}
