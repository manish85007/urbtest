/** X10 · Information classification — ISO 27001 A.5.12 */

export const DATA_CLASSES = {
  public: {
    nm: 'Public',
    ord: 1,
    desc: 'May be published. Marketing material, certifications held.',
  },
  internal: {
    nm: 'Internal',
    ord: 2,
    desc: 'Ordinary business records. Not for release outside Urbeno.',
  },
  confidential: {
    nm: 'Confidential',
    ord: 3,
    desc: 'Client commercial and compliance records. Released only to that client or a regulator.',
  },
  restricted: {
    nm: 'Restricted',
    ord: 4,
    desc: 'Personal data and device-level records. Least privilege, logged access.',
  },
} as const;

export type DataClass = keyof typeof DATA_CLASSES;

export const FILE_CLASS: Record<string, DataClass> = {
  bom: 'confidential',
  weighPhoto: 'internal',
  pickPhoto: 'internal',
  invoice: 'confidential',
  eway: 'confidential',
  processing: 'internal',
  procFile: 'internal',
  serials: 'restricted',
  certificate: 'confidential',
  cod: 'confidential',
  logo: 'public',
  planting: 'public',
  plantPhoto: 'public',
  report: 'internal',
};

export const RETENTION_YEARS = {
  compliance: 5,
  certificate: 10,
  audit: 7,
  personal: 3,
  security: 2,
} as const;

export const ACCESS_REVIEW_DAYS = 90;
export const DSR_DUE_DAYS = 30;
export const APP_VERSION = '6.4';

export const SOD_RULES = [
  { id: 'SOD1', action: 'force-close', nm: 'Force-closing an invoice you raised' },
  { id: 'SOD2', action: 'capacity-override', nm: 'Overriding a capacity limit you are also processing against' },
  { id: 'SOD3', action: 'self-review', nm: 'Certifying your own access in a review' },
] as const;

export const DSR_KINDS = [
  'access',
  'correction',
  'erasure',
  'withdrawal of consent',
  'grievance',
] as const;

export const DISPOSAL_METHODS = [
  'Secure deletion',
  'Cryptographic erasure',
  'Physical destruction',
  'Anonymisation',
  'Archived offline',
] as const;
