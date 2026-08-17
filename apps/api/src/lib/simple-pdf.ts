/** Minimal multi-page Helvetica PDF (A4) — no native deps. */

function pdfEscape(text: string): string {
  return String(text ?? '')
    .replace(/™/g, '(TM)')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, max = 92): string[] {
  const words = String(text ?? '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export interface PdfSection {
  heading?: string;
  lines?: string[];
  pairs?: Array<[string, string, string?, string?]>;
  table?: { headers: string[]; rows: string[][]; total?: string[] };
}

export interface PdfLetterhead {
  name: string;
  brand?: string;
  address?: string;
  gst?: string;
  cin?: string;
  phone?: string;
  email?: string;
  cpcb?: string;
  kspcb?: string;
  logoJpeg?: Buffer;
  logoWidth?: number;
  logoHeight?: number;
}

function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0x01) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function letterheadMeta(lh: PdfLetterhead) {
  const brandLine = [lh.brand, lh.address].filter(Boolean).join(' · ');
  const ids = [
    lh.gst ? `GST ${lh.gst}` : '',
    lh.cin ? `CIN ${lh.cin}` : '',
    lh.phone ? `Ph ${lh.phone}` : '',
    lh.email || '',
  ].filter(Boolean);
  const certs = [lh.cpcb, lh.kspcb].filter(Boolean).join('  |  ');
  return { brandLine, ids: ids.join('  |  '), certs };
}

export function buildTextPdf(
  title: string,
  subtitle: string,
  sections: PdfSection[],
  footer: string,
  letterhead?: PdfLetterhead,
): Buffer {
  const pages: string[][] = [];
  let lines: string[] = [];
  const maxLines = letterhead ? 42 : 48;
  const flush = () => {
    if (lines.length) pages.push(lines);
    lines = [];
  };
  const push = (line: string) => {
    if (lines.length >= maxLines) flush();
    lines.push(line);
  };

  if (!letterhead) {
    push(title.toUpperCase());
    if (subtitle) push(subtitle);
    push('');
  }

  for (const section of sections) {
    if (section.heading) {
      push('');
      push(`— ${section.heading} —`);
    }
    for (const line of section.lines ?? []) {
      for (const wrapped of wrapLine(line)) push(wrapped);
    }
    for (const pair of section.pairs ?? []) {
      push(`${pair[0]}: ${pair[1]}`);
      if (pair[2]) push(`${pair[2]}: ${pair[3] ?? '—'}`);
    }
    if (section.table) {
      push(section.table.headers.join(' | '));
      for (const row of section.table.rows) push(row.join(' | '));
      if (section.table.total) push(section.table.total.join(' | '));
    }
  }
  flush();
  if (!pages.length) pages.push([title]);

  const jpeg =
    letterhead?.logoJpeg && jpegDimensions(letterhead.logoJpeg)
      ? { buf: letterhead.logoJpeg, ...jpegDimensions(letterhead.logoJpeg)! }
      : null;

  const pageCount = pages.length;
  const imageId = jpeg ? 3 + pageCount * 2 : 0;
  const fontId = jpeg ? imageId + 1 : 3 + pageCount * 2;
  const pageIds = pages.map((_, i) => 3 + i * 2);

  const objects: Array<string | Buffer> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];

  const xStart = jpeg ? 86 : 50;
  const textStartY = letterhead ? 768 : 800;

  for (let i = 0; i < pageCount; i++) {
    const xobj = jpeg ? ` /XObject << /Im1 ${imageId} 0 R >>` : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fontId} 0 R >>${xobj} >> >>`,
    );

    const ops: string[] = [];
    if (letterhead && i === 0) {
      const meta = letterheadMeta(letterhead);
      ops.push('q', '0.231 0.427 0.067 rg', '0 786 595 56 re', 'f', 'Q');
      if (jpeg) {
        const maxH = 36;
        const scale = Math.min(maxH / jpeg.h, 40 / jpeg.w);
        const w = jpeg.w * scale;
        const h = jpeg.h * scale;
        ops.push('q', `${w.toFixed(2)} 0 0 ${h.toFixed(2)} 14 ${802 + (maxH - h) / 2} cm`, '/Im1 Do', 'Q');
      }
      ops.push(
        'BT',
        '/F1 13 Tf',
        '1 1 1 rg',
        `${xStart} 826 Td`,
        `(${pdfEscape(letterhead.name)}) Tj`,
        'T*',
        '/F1 8 Tf',
        `(${pdfEscape(meta.brandLine)}) Tj`,
        'T*',
        `(${pdfEscape(meta.ids)}) Tj`,
        meta.certs ? 'T*' : '',
        meta.certs ? `(${pdfEscape(meta.certs)}) Tj` : '',
        '0 0 0 rg',
        'ET',
        'BT',
        '/F1 14 Tf',
        '14 TL',
        `50 772 Td`,
        `(${pdfEscape(title.toUpperCase())}) Tj`,
        'T*',
        '/F1 11 Tf',
        subtitle ? `(${pdfEscape(subtitle)}) Tj` : '',
        subtitle ? 'T*' : '',
        'T*',
      );
      pages[i].forEach((line) => {
        ops.push(`(${pdfEscape(line)}) Tj`, 'T*');
      });
      ops.push(`/F1 8 Tf (${pdfEscape(footer)} · page ${i + 1} of ${pageCount}) Tj`, 'ET');
    } else {
      ops.push('BT', '/F1 11 Tf', '14 TL', `50 ${letterhead && i > 0 ? 800 : textStartY} Td`);
      pages[i].forEach((line, idx) => {
        const prefix = idx === 0 && !letterhead ? '/F1 14 Tf ' : '';
        const reset = idx === 0 && !letterhead ? ' /F1 11 Tf' : '';
        ops.push(`${prefix}(${pdfEscape(line)}) Tj${reset}`, 'T*');
      });
      ops.push(`/F1 8 Tf (${pdfEscape(footer)} · page ${i + 1} of ${pageCount}) Tj`, 'ET');
    }

    const stream = ops.filter(Boolean).join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  }

  if (jpeg) {
    const header = Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${jpeg.w} /Height ${jpeg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.buf.length} >>\nstream\n`,
      'utf8',
    );
    const tail = Buffer.from('\nendstream', 'utf8');
    objects.push(Buffer.concat([header, jpeg.buf, tail]));
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(parts.reduce((n, p) => n + p.length, 0));
    const obj = objects[i];
    const body = Buffer.isBuffer(obj) ? obj : Buffer.from(obj, 'utf8');
    parts.push(
      Buffer.concat([
        Buffer.from(`${i + 1} 0 obj\n`, 'utf8'),
        body,
        Buffer.from('\nendobj\n', 'utf8'),
      ]),
    );
  }
  const bodyBuf = Buffer.concat(parts);
  const xrefAt = bodyBuf.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = Buffer.from(
    `${xref}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    'utf8',
  );
  return Buffer.concat([bodyBuf, trailer]);
}
