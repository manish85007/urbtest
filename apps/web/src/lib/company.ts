/** Public Urbeno contact — matches kit CFG.co with the live WhatsApp number. */
export const COMPANY = {
  name: 'Urbeno Private Limited',
  brand: 'Recycling Heroes™',
  email: 'info@urbeno.in',
  phone: '1800-123-4567',
  phoneTel: '18001234567',
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
