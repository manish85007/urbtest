/** ASCII-safe Content-Disposition value (avoids ERR_INVALID_CHAR from raw filenames). */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const base = String(filename || 'download')
    .replace(/[\\/"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const safe = base || 'download';
  return `${type}; filename="${safe}"`;
}
