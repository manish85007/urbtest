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
  pickPhoto: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
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

export function isMimeAllowed(kind: FileKind, mimeType: string): boolean {
  const allowed = MIME_BY_KIND[kind];
  if (!allowed) return true;
  const mime = mimeType.toLowerCase();
  return allowed.some((a) => mime === a || mime.startsWith(`${a};`));
}
