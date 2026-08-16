/** Minimal multi-page Helvetica PDF (A4) — no native deps. */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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

export function buildTextPdf(title: string, subtitle: string, sections: PdfSection[], footer: string): Buffer {
  const pages: string[][] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) pages.push(lines);
    lines = [];
  };
  const push = (line: string) => {
    if (lines.length >= 48) flush();
    lines.push(line);
  };

  push(title.toUpperCase());
  if (subtitle) push(subtitle);
  push('');

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

  const fontId = 3 + pages.length * 2;
  const pageIds = pages.map((_, i) => 3 + i * 2);
  const numbered: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  for (let i = 0; i < pages.length; i++) {
    numbered.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    const ops: string[] = ['BT', '/F1 11 Tf', '14 TL', '50 800 Td'];
    pages[i].forEach((line, idx) => {
      const prefix = idx === 0 ? '/F1 14 Tf ' : '';
      const reset = idx === 0 ? ' /F1 11 Tf' : '';
      ops.push(`${prefix}(${pdfEscape(line)}) Tj${reset}`, 'T*');
    });
    ops.push(`/F1 8 Tf (${pdfEscape(footer)} · page ${i + 1} of ${pages.length}) Tj`, 'ET');
    const stream = ops.join('\n');
    numbered.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  }
  numbered.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < numbered.length; i++) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${i + 1} 0 obj\n${numbered[i]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${numbered.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= numbered.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer << /Size ${numbered.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}
