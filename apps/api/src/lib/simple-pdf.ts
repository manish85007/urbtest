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
  const raw = String(text ?? '').trim() || '—';
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let cur = '';

  const pushChunk = (chunk: string) => {
    if (!chunk) return;
    if (chunk.length <= max) {
      if (cur) lines.push(cur);
      cur = chunk;
      return;
    }
    if (cur) {
      lines.push(cur);
      cur = '';
    }
    for (let i = 0; i < chunk.length; i += max) {
      lines.push(chunk.slice(i, i + max));
    }
  };

  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      if (w.length > max) pushChunk(w);
      else cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ['—'];
}

function charsForWidth(widthPt: number, fontSize: number): number {
  // Helvetica average glyph ≈ 0.5em; leave a small gutter.
  return Math.max(12, Math.floor(widthPt / (fontSize * 0.52)));
}

function textWidth(text: string, size: number, bold = false): number {
  // Helvetica averages ~0.5em; Bold runs a touch wider.
  return String(text ?? '').length * size * (bold ? 0.56 : 0.5);
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
  table?: {
    headers: string[];
    rows: string[][];
    total?: string[];
    aligns?: Array<'l' | 'r'>;
    /** Relative column weights — preferred over auto sizing for Form 6 / MRN tables. */
    colWeights?: number[];
  };
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
  docLabel?: string;
  barColor?: [number, number, number];
  variant?: 'bar' | 'document';
  logoJpeg?: Buffer;
  logoWidth?: number;
  logoHeight?: number;
  logoMaxWidth?: number;
  logoMaxHeight?: number;
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
    if (this.letterhead?.variant === 'document') {
      this.drawDocumentLetterhead(first);
      return;
    }
    const lh = this.letterhead!;
    const barH = first ? (this.jpeg && (lh.logoMaxWidth ?? 0) >= 120 ? 72 : 80) : 28;
    const barBottom = PAGE_H - barH;
    const barColor = lh.barColor ?? GREEN;
    this.fillRect(0, barBottom, PAGE_W, barH, barColor);

    let textX = MARGIN_X;
    if (first && this.jpeg) {
      const maxH = lh.logoMaxHeight ?? 40;
      const maxW = lh.logoMaxWidth ?? 44;
      const scale = Math.min(maxH / this.jpeg.h, maxW / this.jpeg.w, 1);
      const w = this.jpeg.w * scale;
      const h = this.jpeg.h * scale;
      const x = 14;
      const y = barBottom + (barH - h) / 2;
      this.ops.push('q', `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, '/Im1 Do', 'Q');
      textX = 14 + w + 12;
    }

    const onBar = WHITE;

    if (first) {
      if (!this.jpeg || (lh.logoMaxWidth ?? 0) < 120) {
        this.text('F2', 15, textX, PAGE_H - 20, lh.name, onBar);
        const brandLine = [lh.brand, lh.address].filter(Boolean).join('  |  ');
        if (brandLine) this.text('F1', 8, textX, PAGE_H - 34, brandLine, onBar);
        const ids = [
          lh.gst ? `GST ${lh.gst}` : '',
          lh.cin ? `CIN ${lh.cin}` : '',
          lh.phone ? `Ph ${lh.phone}` : '',
        ]
          .filter(Boolean)
          .join('  |  ');
        if (ids) this.text('F1', 7, textX, PAGE_H - 48, ids, onBar);
        const certs = [lh.cpcb, lh.kspcb].filter(Boolean).join('  |  ');
        if (certs) this.text('F1', 7, textX, PAGE_H - 60, certs, onBar);
      }
      if (lh.docNo) {
        this.text('F2', 9, PAGE_W - MARGIN_X, PAGE_H - 18, lh.docNo, onBar, 'r');
        if (lh.docLabel) this.text('F2', 9, PAGE_W - MARGIN_X, PAGE_H - 32, lh.docLabel, onBar, 'r');
        if (lh.docDate) this.text('F1', 7, PAGE_W - MARGIN_X, PAGE_H - 46, lh.docDate, onBar, 'r');
      }
      this.text('F2', 13, PAGE_W / 2, PAGE_H - barH - 22, this.title, BLACK, 'c');
      if (this.subtitle) this.text('F1', 8.5, PAGE_W / 2, PAGE_H - barH - 36, this.subtitle, MUTED, 'c');
      this.y = PAGE_H - barH - 52;
    } else {
      this.text('F2', 10, textX, PAGE_H - 18, lh.name, onBar);
      if (lh.docNo) this.text('F1', 8, PAGE_W - MARGIN_X, PAGE_H - 18, lh.docNo, onBar, 'r');
      this.y = PAGE_H - barH - 18;
    }
  }

  drawDocumentLetterhead(first: boolean) {
    const lh = this.letterhead!;
    const maxH = first ? (lh.logoMaxHeight ?? 36) : 20;
    const maxW = first ? (lh.logoMaxWidth ?? 150) : 90;
    let logoH = 0;
    if (this.jpeg) {
      const scale = Math.min(maxH / this.jpeg.h, maxW / this.jpeg.w, 1);
      const w = this.jpeg.w * scale;
      const h = this.jpeg.h * scale;
      logoH = h;
      const x = MARGIN_X;
      const y = PAGE_H - 16 - h;
      this.ops.push('q', `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, '/Im1 Do', 'Q');
    } else if (first) {
      this.text('F2', 14, MARGIN_X, PAGE_H - 22, lh.name, GREEN_DARK);
      if (lh.brand) this.text('F1', 8, MARGIN_X, PAGE_H - 34, lh.brand, MUTED);
      logoH = 28;
    }

    if (first) {
      if (lh.docNo) this.text('F2', 9, PAGE_W - MARGIN_X, PAGE_H - 20, lh.docNo, GREEN_DARK, 'r');
      if (lh.docLabel) this.text('F2', 9, PAGE_W - MARGIN_X, PAGE_H - 34, lh.docLabel, GREEN, 'r');
      if (lh.docDate) this.text('F1', 7.5, PAGE_W - MARGIN_X, PAGE_H - 46, lh.docDate, MUTED, 'r');

      // Statutory lines under the logo (Masters → Company profile).
      let metaY = PAGE_H - Math.max(logoH + 22, 54);
      const metaMax = charsForWidth(CONTENT_W - 160, 7.2); // leave room for doc meta on the right
      if (lh.address) {
        for (const line of wrapLine(lh.address, metaMax)) {
          this.text('F1', 7.2, MARGIN_X, metaY, line, MUTED);
          metaY -= 10;
        }
      }
      const ids = [
        lh.gst ? `GSTIN ${lh.gst}` : '',
        lh.cin ? `CIN ${lh.cin}` : '',
        lh.phone ? `Ph ${lh.phone}` : '',
        lh.email || '',
      ]
        .filter(Boolean)
        .join('  ·  ');
      if (ids) {
        for (const line of wrapLine(ids, metaMax)) {
          this.text('F1', 7, MARGIN_X, metaY, line, MUTED);
          metaY -= 10;
        }
      }
      const certs = [lh.cpcb ? `CPCB ${lh.cpcb}` : '', lh.kspcb ? `State PCB ${lh.kspcb}` : '']
        .filter(Boolean)
        .join('  ·  ');
      if (certs) {
        for (const line of wrapLine(certs, metaMax)) {
          this.text('F1', 7, MARGIN_X, metaY, line, GREEN_DARK);
          metaY -= 10;
        }
      }
      metaY -= 2;

      const ruleY = Math.min(metaY - 2, PAGE_H - Math.max(logoH + 24, 58));
      this.fillRect(MARGIN_X, ruleY, CONTENT_W, 1.5, GREEN);
      this.text('F2', 13, PAGE_W / 2, ruleY - 18, this.title, GREEN_DARK, 'c');
      if (this.subtitle) {
        const subLines = wrapLine(this.subtitle, charsForWidth(CONTENT_W, 8.5));
        let sy = ruleY - 32;
        for (const line of subLines.slice(0, 2)) {
          this.text('F1', 8.5, PAGE_W / 2, sy, line, MUTED, 'c');
          sy -= 11;
        }
        this.y = sy - 14;
      } else {
        this.y = ruleY - 48;
      }
    } else {
      if (!this.jpeg) this.text('F2', 10, MARGIN_X, PAGE_H - 18, lh.name, GREEN_DARK);
      if (lh.docNo) this.text('F1', 8, PAGE_W - MARGIN_X, PAGE_H - 18, lh.docNo, GREEN_DARK, 'r');
      const ruleY = PAGE_H - Math.max(logoH + 20, 36);
      this.fillRect(MARGIN_X, ruleY, CONTENT_W, 1, GREEN);
      this.y = ruleY - 16;
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
    const lines = wrapLine(String(label ?? '').toUpperCase(), charsForWidth(CONTENT_W - 16, 8.5));
    const bandH = 10 + lines.length * 11;
    this.ensure(bandH + 12);
    this.y -= 6;
    this.fillRect(MARGIN_X, this.y - 4 - (bandH - 16), CONTENT_W, bandH, BAND);
    for (const line of lines) {
      this.text('F2', 8.5, MARGIN_X + 6, this.y, line, GREEN_DARK);
      this.y -= 11;
    }
    this.y -= 8;
  }

  pair(l1: string, v1: string, l2?: string, v2?: string) {
    const dual = Boolean(l2);
    const gutter = 14;
    const leftW = dual ? COL2_X - MARGIN_X - gutter : CONTENT_W;
    const rightW = PAGE_W - MARGIN_X - COL2_X;
    const valueSize = 9;
    const labelSize = 6.8;
    const leftMax = charsForWidth(leftW, valueSize);
    const rightMax = charsForWidth(rightW, valueSize);
    const labelMax = charsForWidth(dual ? leftW : CONTENT_W, labelSize);

    const leftLines = wrapLine(String(v1 ?? '—'), leftMax);
    const rightLines = dual ? wrapLine(String(v2 ?? '—'), rightMax) : [];
    const rows = Math.max(leftLines.length, rightLines.length, 1);

    this.ensure(18 + rows * 12);
    this.text('F2', labelSize, MARGIN_X, this.y, String(l1 ?? '').toUpperCase().slice(0, labelMax), LABEL);
    if (dual) {
      this.text(
        'F2',
        labelSize,
        COL2_X,
        this.y,
        String(l2 ?? '').toUpperCase().slice(0, charsForWidth(rightW, labelSize)),
        LABEL,
      );
    }
    this.y -= 11;
    for (let i = 0; i < rows; i++) {
      this.ensure(14);
      if (leftLines[i]) this.text('F1', valueSize, MARGIN_X, this.y, leftLines[i]);
      if (dual && rightLines[i]) this.text('F1', valueSize, COL2_X, this.y, rightLines[i]);
      this.y -= 12;
    }
    this.y -= 6;
  }

  paragraph(line: string) {
    for (const wrapped of wrapLine(line, charsForWidth(CONTENT_W, 9))) {
      this.ensure(16);
      this.text('F1', 9, MARGIN_X, this.y, wrapped);
      this.y -= 13;
    }
  }

  table(table: NonNullable<PdfSection['table']>) {
    const cols = table.headers.length;
    const aligns = table.aligns ?? table.headers.map((_, i) => (i === cols - 1 ? 'r' : 'l'));
    const headerSize = 7;
    const cellSize = 7.4;
    const pad = 10;

    const headerMin = table.headers.map(
      (h) => textWidth(h.toUpperCase(), headerSize, true) + pad + 4,
    );

    let colW: number[];
    if (table.colWeights && table.colWeights.length === cols) {
      const sum = table.colWeights.reduce((a, b) => a + b, 0) || 1;
      colW = table.colWeights.map((w) => (w / sum) * CONTENT_W);
      // Guarantee every header fits — borrow from the widest spare column.
      for (let i = 0; i < cols; i++) {
        if (colW[i] + 0.01 >= headerMin[i]) continue;
        const need = headerMin[i] - colW[i];
        let donor = -1;
        let donorSpare = 0;
        for (let j = 0; j < cols; j++) {
          if (j === i) continue;
          const spare = colW[j] - headerMin[j];
          if (spare > donorSpare) {
            donorSpare = spare;
            donor = j;
          }
        }
        if (donor >= 0 && donorSpare > 0) {
          const take = Math.min(need, donorSpare);
          colW[i] += take;
          colW[donor] -= take;
        } else {
          colW[i] = headerMin[i];
        }
      }
      const total = colW.reduce((a, b) => a + b, 0) || 1;
      colW = colW.map((w) => (w / total) * CONTENT_W);
    } else {
      const isFlex = (header: string, i: number) =>
        i === 0 || /desc|name|vehicle|driver|fraction|address|phone/i.test(header);
      const minW = table.headers.map((h, i) => {
        const dataNeed = isFlex(h, i)
          ? 64
          : Math.min(
              110,
              Math.max(
                ...table.rows.map((r) => textWidth(String(r[i] ?? '—'), cellSize) + pad),
                headerMin[i],
              ),
            );
        return Math.max(headerMin[i], dataNeed, 48);
      });
      const sumMin = minW.reduce((a, b) => a + b, 0);
      if (sumMin > CONTENT_W) {
        colW = minW.map((w) => (w / sumMin) * CONTENT_W);
      } else {
        colW = [...minW];
        const extra = CONTENT_W - sumMin;
        const flexIdx = table.headers.map((h, i) => (isFlex(h, i) ? i : -1)).filter((i) => i >= 0);
        const targets = flexIdx.length ? flexIdx : table.headers.map((_, i) => i);
        const each = extra / targets.length;
        for (const i of targets) colW[i] += each;
      }
    }

    // Prefer single-line headers; only wrap if the column is still too narrow after weighting.
    const headerLines = table.headers.map((h, i) => {
      const max = charsForWidth(Math.max(16, colW[i] - pad), headerSize);
      const upper = h.toUpperCase();
      if (upper.length <= max) return [upper];
      return wrapLine(upper, max);
    });
    const headerRowLines = Math.max(1, ...headerLines.map((l) => l.length));
    const headerBandH = 12 + headerRowLines * 10;

    this.ensure(headerBandH + 24);
    this.y -= 4;
    this.fillRect(MARGIN_X, this.y - 4 - (headerBandH - 16), CONTENT_W, headerBandH, GREEN);

    for (let li = 0; li < headerRowLines; li++) {
      let x = MARGIN_X;
      headerLines.forEach((lines, i) => {
        const ax = aligns[i] === 'r' ? x + colW[i] - 5 : x + 5;
        if (lines[li]) {
          this.text('F2', headerSize, ax, this.y, lines[li], WHITE, aligns[i] === 'r' ? 'r' : 'l');
        }
        x += colW[i];
      });
      this.y -= 10;
    }
    this.y -= 6;

    table.rows.forEach((row, ri) => {
      const cellLines = row.map((cell, i) => {
        const raw = String(cell ?? '—');
        const max = charsForWidth(Math.max(14, colW[i] - pad), cellSize);
        // Keep compact tokens (phones, slip nos, codes) on one line when possible.
        if (raw.length <= max) return [raw];
        return wrapLine(raw, max);
      });
      const lines = Math.max(1, ...cellLines.map((l) => l.length));
      this.ensure(10 + lines * 11);
      const rowH = lines * 11 + 2;
      if (ri % 2) this.fillRect(MARGIN_X, this.y - 4 - (rowH - 14), CONTENT_W, rowH, [0.976, 0.976, 0.965]);
      for (let li = 0; li < lines; li++) {
        let x = MARGIN_X;
        cellLines.forEach((wrapped, i) => {
          const ax = aligns[i] === 'r' ? x + colW[i] - 5 : x + 5;
          if (wrapped[li]) {
            this.text('F1', cellSize, ax, this.y, wrapped[li], BLACK, aligns[i] === 'r' ? 'r' : 'l');
          }
          x += colW[i];
        });
        this.y -= 11;
      }
      this.y -= 2;
    });

    if (table.total) {
      this.ensure(18);
      this.strokeLine(MARGIN_X, this.y + 8, MARGIN_X + CONTENT_W, this.y + 8);
      let x = MARGIN_X;
      table.total.forEach((cell, i) => {
        const ax = aligns[i] === 'r' ? x + colW[i] - 5 : x + 5;
        const label = String(cell ?? '');
        if (label) {
          const max = charsForWidth(Math.max(14, colW[i] - pad), 8);
          const shown = label.length <= max ? label : wrapLine(label, max)[0];
          this.text('F2', 8, ax, this.y, shown, BLACK, aligns[i] === 'r' ? 'r' : 'l');
        }
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
