/** A4 PDF with kit-style letterhead — Helvetica / WinAnsi, no native deps. */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 40;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const COL2_X = 306;
const FOOTER_Y = 36;
const GREEN: [number, number, number] = [0.231, 0.427, 0.067];
const GREEN_DARK: [number, number, number] = [0.165, 0.302, 0.047];
const BAND: [number, number, number] = [0.933, 0.957, 0.902];
const LABEL: [number, number, number] = [0.47, 0.47, 0.47];
const MUTED: [number, number, number] = [0.353, 0.353, 0.353];
const WHITE: [number, number, number] = [1, 1, 1];
const BLACK: [number, number, number] = [0, 0, 0];
const RULE: [number, number, number] = [0.78, 0.78, 0.78];

const WINANSI: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
  '·': 0xb7,
};

/** Map Unicode to a PDF literal string in WinAnsiEncoding. */
export function pdfString(text: string): string {
  let out = '';
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0) ?? 32;
    let b: number;
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`;
      continue;
    }
    if (WINANSI[ch] !== undefined) b = WINANSI[ch];
    else if (code === 0x2212 || code === 0x2010 || code === 0x2011) b = 0x2d; // minus / hyphen
    else if (code >= 0x20 && code <= 0x7e) b = code;
    else if (code >= 0xa0 && code <= 0xff) b = code;
    else b = 0x2d; // unmappable → hyphen, never '?'
    if (b < 0x20 || b > 0x7e) out += `\\${b.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(b);
  }
  return out;
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

function textWidth(text: string, size: number): number {
  return String(text ?? '').length * size * 0.5;
}

function rgb(c: [number, number, number]): string {
  return `${c[0]} ${c[1]} ${c[2]} rg`;
}

function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
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

export interface PdfSection {
  heading?: string;
  lines?: string[];
  pairs?: Array<[string, string, string?, string?]>;
  table?: { headers: string[]; rows: string[][]; total?: string[]; aligns?: Array<'l' | 'r'> };
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
  docNo?: string;
  docDate?: string;
  logoJpeg?: Buffer;
  logoWidth?: number;
  logoHeight?: number;
}

interface JpegLogo {
  buf: Buffer;
  w: number;
  h: number;
}

class Painter {
  pages: string[][] = [];
  ops: string[] = [];
  y = 800;
  letterhead?: PdfLetterhead;
  jpeg: JpegLogo | null = null;
  footer = '';
  title = '';
  subtitle = '';

  flush() {
    if (this.ops.length) this.pages.push(this.ops);
    this.ops = [];
  }

  ensure(need = 48) {
    if (this.y < FOOTER_Y + need) this.newPage(false);
  }

  newPage(first: boolean) {
    this.flush();
    if (this.letterhead) this.drawLetterhead(first);
    else {
      this.y = 800;
      if (first) this.drawPlainTitle();
    }
  }

  fillRect(x: number, y: number, w: number, h: number, color: [number, number, number]) {
    this.ops.push('q', rgb(color), `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`, 'f', 'Q');
  }

  strokeLine(x1: number, y1: number, x2: number, y2: number) {
    this.ops.push(
      'q',
      `${RULE[0]} ${RULE[1]} ${RULE[2]} RG`,
      '0.4 w',
      `${x1.toFixed(2)} ${y1.toFixed(2)} m`,
      `${x2.toFixed(2)} ${y2.toFixed(2)} l`,
      'S',
      'Q',
    );
  }

  text(
    font: 'F1' | 'F2',
    size: number,
    x: number,
    y: number,
    str: string,
    color: [number, number, number] = BLACK,
    align: 'l' | 'c' | 'r' = 'l',
  ) {
    const s = String(str ?? '');
    let tx = x;
    if (align === 'c') tx = x - textWidth(s, size) / 2;
    if (align === 'r') tx = x - textWidth(s, size);
    this.ops.push(
      'BT',
      `/${font} ${size} Tf`,
      rgb(color),
      `1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm`,
      `(${pdfString(s)}) Tj`,
      'ET',
    );
  }

  drawLetterhead(first: boolean) {
    const lh = this.letterhead!;
    const barH = first ? 80 : 28;
    const barBottom = PAGE_H - barH;
    this.fillRect(0, barBottom, PAGE_W, barH, GREEN);

    let textX = MARGIN_X;
    if (first && this.jpeg) {
      const maxH = 40;
      const maxW = 44;
      const scale = Math.min(maxH / this.jpeg.h, maxW / this.jpeg.w);
      const w = this.jpeg.w * scale;
      const h = this.jpeg.h * scale;
      const x = 14;
      const y = barBottom + (barH - h) / 2;
      this.ops.push('q', `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, '/Im1 Do', 'Q');
      textX = 14 + w + 10;
    }

    if (first) {
      this.text('F2', 15, textX, PAGE_H - 20, lh.name, WHITE);
      const brandLine = [lh.brand, lh.address].filter(Boolean).join('  |  ');
      if (brandLine) this.text('F1', 8, textX, PAGE_H - 34, brandLine, WHITE);
      const ids = [
        lh.gst ? `GST ${lh.gst}` : '',
        lh.cin ? `CIN ${lh.cin}` : '',
        lh.phone ? `Ph ${lh.phone}` : '',
      ]
        .filter(Boolean)
        .join('  |  ');
      if (ids) this.text('F1', 7, textX, PAGE_H - 48, ids, WHITE);
      const certs = [lh.cpcb, lh.kspcb].filter(Boolean).join('  |  ');
      if (certs) this.text('F1', 7, textX, PAGE_H - 60, certs, WHITE);
      if (lh.docNo) {
        this.text('F2', 9, PAGE_W - MARGIN_X, PAGE_H - 22, lh.docNo, WHITE, 'r');
        if (lh.docDate) this.text('F1', 7, PAGE_W - MARGIN_X, PAGE_H - 34, lh.docDate, WHITE, 'r');
      }
      this.text('F2', 13, PAGE_W / 2, PAGE_H - barH - 22, this.title, BLACK, 'c');
      if (this.subtitle) this.text('F1', 8.5, PAGE_W / 2, PAGE_H - barH - 36, this.subtitle, MUTED, 'c');
      this.y = PAGE_H - barH - 52;
    } else {
      this.text('F2', 10, textX, PAGE_H - 18, lh.name, WHITE);
      if (lh.docNo) this.text('F1', 8, PAGE_W - MARGIN_X, PAGE_H - 18, lh.docNo, WHITE, 'r');
      this.y = PAGE_H - barH - 18;
    }
  }

  drawPlainTitle() {
    this.text('F2', 14, MARGIN_X, this.y, this.title);
    this.y -= 16;
    if (this.subtitle) {
      this.text('F1', 9, MARGIN_X, this.y, this.subtitle, MUTED);
      this.y -= 14;
    }
    this.y -= 6;
  }

  band(label: string) {
    this.ensure(28);
    this.y -= 6;
    this.fillRect(MARGIN_X, this.y - 4, CONTENT_W, 16, BAND);
    this.text('F2', 8.5, MARGIN_X + 6, this.y, label.toUpperCase(), GREEN_DARK);
    this.y -= 22;
  }

  pair(l1: string, v1: string, l2?: string, v2?: string) {
    this.ensure(32);
    this.text('F2', 6.8, MARGIN_X, this.y, l1.toUpperCase(), LABEL);
    if (l2) this.text('F2', 6.8, COL2_X, this.y, l2.toUpperCase(), LABEL);
    this.y -= 12;
    this.text('F1', 9.5, MARGIN_X, this.y, String(v1 ?? '-').slice(0, 52));
    if (l2) this.text('F1', 9.5, COL2_X, this.y, String(v2 ?? '-').slice(0, 52));
    this.y -= 16;
  }

  paragraph(line: string) {
    for (const wrapped of wrapLine(line, 96)) {
      this.ensure(16);
      this.text('F1', 9, MARGIN_X, this.y, wrapped);
      this.y -= 13;
    }
  }

  table(table: NonNullable<PdfSection['table']>) {
    const cols = table.headers.length;
    const widths = table.headers.map((_, i) => {
      const weight = Math.max(table.headers[i].length, ...table.rows.map((r) => String(r[i] ?? '').length), 6);
      return weight;
    });
    const sumW = widths.reduce((a, b) => a + b, 0) || 1;
    const colW = widths.map((w) => (w / sumW) * CONTENT_W);
    const aligns = table.aligns ?? table.headers.map((_, i) => (i === cols - 1 ? 'r' : 'l'));

    this.ensure(28 + table.rows.length * 14);
    this.y -= 4;
    this.fillRect(MARGIN_X, this.y - 4, CONTENT_W, 16, GREEN);
    let x = MARGIN_X;
    table.headers.forEach((h, i) => {
      const ax = aligns[i] === 'r' ? x + colW[i] - 4 : x + 4;
      this.text('F2', 7, ax, this.y, h.toUpperCase(), WHITE, aligns[i] === 'r' ? 'r' : 'l');
      x += colW[i];
    });
    this.y -= 16;

    table.rows.forEach((row, ri) => {
      this.ensure(18);
      if (ri % 2) this.fillRect(MARGIN_X, this.y - 4, CONTENT_W, 14, [0.976, 0.976, 0.965]);
      x = MARGIN_X;
      row.forEach((cell, i) => {
        const ax = aligns[i] === 'r' ? x + colW[i] - 4 : x + 4;
        const maxChars = Math.max(6, Math.floor(colW[i] / 4.2));
        this.text('F1', 7.6, ax, this.y, String(cell ?? '').slice(0, maxChars), BLACK, aligns[i] === 'r' ? 'r' : 'l');
        x += colW[i];
      });
      this.y -= 14;
    });

    if (table.total) {
      this.ensure(18);
      this.strokeLine(MARGIN_X, this.y + 8, MARGIN_X + CONTENT_W, this.y + 8);
      x = MARGIN_X;
      table.total.forEach((cell, i) => {
        const ax = aligns[i] === 'r' ? x + colW[i] - 4 : x + 4;
        if (cell) this.text('F2', 8, ax, this.y, String(cell), BLACK, aligns[i] === 'r' ? 'r' : 'l');
        x += colW[i];
      });
      this.y -= 16;
    }
    this.y -= 4;
  }
}

function applyFooters(pages: string[][], footer: string) {
  const total = pages.length;
  const pageLabel = (i: number) => `Page ${i + 1} of ${total}`;
  return pages.map((ops, i) => {
    const label = pageLabel(i);
    return [
      ...ops,
      'q',
      `${RULE[0]} ${RULE[1]} ${RULE[2]} RG`,
      '0.3 w',
      `${MARGIN_X} ${FOOTER_Y + 10} m`,
      `${PAGE_W - MARGIN_X} ${FOOTER_Y + 10} l`,
      'S',
      'Q',
      'BT',
      '/F1 6.5 Tf',
      rgb(LABEL),
      `1 0 0 1 ${MARGIN_X} ${FOOTER_Y} Tm`,
      `(${pdfString(footer)}) Tj`,
      'ET',
      'BT',
      '/F1 6.5 Tf',
      rgb(LABEL),
      `1 0 0 1 ${(PAGE_W - MARGIN_X - textWidth(label, 6.5)).toFixed(2)} ${FOOTER_Y} Tm`,
      `(${pdfString(label)}) Tj`,
      'ET',
    ];
  });
}

export function buildTextPdf(
  title: string,
  subtitle: string,
  sections: PdfSection[],
  footer: string,
  letterhead?: PdfLetterhead,
): Buffer {
  const painter = new Painter();
  painter.title = title;
  painter.subtitle = subtitle;
  painter.footer = footer;
  painter.letterhead = letterhead;
  const dims = letterhead?.logoJpeg ? jpegDimensions(letterhead.logoJpeg) : null;
  painter.jpeg = dims && letterhead?.logoJpeg ? { buf: letterhead.logoJpeg, ...dims } : null;

  painter.newPage(true);

  for (const section of sections) {
    if (section.heading) painter.band(section.heading);
    for (const line of section.lines ?? []) painter.paragraph(line);
    for (const pair of section.pairs ?? []) {
      painter.pair(pair[0], pair[1], pair[2], pair[3]);
    }
    if (section.table) painter.table(section.table);
  }

  painter.flush();
  if (!painter.pages.length) {
    painter.newPage(true);
    painter.flush();
  }

  const pages = applyFooters(painter.pages, footer);
  return assemblePdf(pages, painter.jpeg);
}

function assemblePdf(pages: string[][], jpeg: JpegLogo | null): Buffer {
  const pageCount = pages.length;
  const pageIds = pages.map((_, i) => 3 + i * 2);
  let nextId = 3 + pageCount * 2;
  const imageId = jpeg ? nextId++ : 0;
  const f1 = nextId++;
  const f2 = nextId++;

  const objects: Array<string | Buffer> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
  ];

  for (let i = 0; i < pageCount; i++) {
    const xobj = jpeg ? ` /XObject << /Im1 ${imageId} 0 R >>` : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xobj} >> >>`,
    );
    const stream = pages[i].join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  }

  if (jpeg) {
    const header = Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${jpeg.w} /Height ${jpeg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.buf.length} >>\nstream\n`,
      'utf8',
    );
    objects.push(Buffer.concat([header, jpeg.buf, Buffer.from('\nendstream', 'utf8')]));
  }

  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(parts.reduce((n, p) => n + p.length, 0));
    const raw = objects[i];
    const body: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
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
