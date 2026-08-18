import type { FileKind } from '@prisma/client';

/** Size caps from prototype CFG.maxFile (MB). */
const MB = 1024 * 1024;

const LIMIT_MB: Record<string, number> = {
  photo: 5,
  doc: 10,
  cod: 5,
  logo: 2,
  csv: 5,
};

function bucketForKind(kind: FileKind): keyof typeof LIMIT_MB {
  switch (kind) {
    case 'weighPhoto':
    case 'pickPhoto':
    case 'planting':
    case 'processing':
      return 'photo';
    case 'certificate':
      return 'cod';
    case 'logo':
      return 'logo';
    case 'serials':
      return 'csv';
    default:
      return 'doc';
  }
}

export function maxBytesForKind(kind: FileKind): number {
  return LIMIT_MB[bucketForKind(kind)] * MB;
}

export function maxMbForKind(kind: FileKind): number {
  return LIMIT_MB[bucketForKind(kind)];
}

const MIME_BY_KIND: Partial<Record<FileKind, string[]>> = {
  weighPhoto: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  pickPhoto: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'image/bmp'],
  planting: ['image/jpeg', 'image/png', 'image/webp'],
  processing: ['image/jpeg', 'image/png', 'image/webp'],
  certificate: ['application/pdf'],
  logo: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  serials: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  bom: [
    'text/csv',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  invoice: ['application/pdf', 'image/jpeg', 'image/png'],
  eway: ['application/pdf', 'image/jpeg', 'image/png'],
  report: ['application/pdf'],
};

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/heif': 'image/heic',
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  gif: 'image/gif',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function mimeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()?.trim() ?? '';
  return EXT_TO_MIME[ext] ?? '';
}

export function isMimeAllowed(kind: FileKind, mimeType: string, filename = ''): boolean {
  const allowed = MIME_BY_KIND[kind];
  if (!allowed) return true;
  const raw = (mimeType || '').toLowerCase().split(';')[0].trim();
  const mime = MIME_ALIASES[raw] || raw;
  if (mime && allowed.some((a) => mime === a || mime.startsWith(`${a};`))) return true;
  const fromName = mimeFromFilename(filename);
  if (fromName && allowed.includes(fromName)) return true;
  return false;
}
