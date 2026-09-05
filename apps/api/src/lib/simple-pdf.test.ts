import { describe, expect, it } from 'vitest';
import { buildTextPdf, pdfString } from '../lib/simple-pdf.js';

function pdfTexts(buf: Buffer): string[] {
  const s = buf.toString('latin1');
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let t = m[0].slice(1, m[0].lastIndexOf(')'));
    t = t
      .replace(/\\([\\()nrt])/g, (_, c: string) =>
        ({ '\\': '\\', '(': '(', ')': ')', n: '\n', r: '\r', t: '\t' })[c] ?? c,
      )
      .replace(/\\(\d{3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
    out.push(t);
  }
  return out;
}

describe('simple-pdf', () => {
  it('encodes dashes and middle dots as WinAnsi, never as ? or UTF-8', () => {
    expect(pdfString('FORM 6 — MANIFEST')).toContain('\\227');
    expect(pdfString('Rule 12 · one manifest')).toContain('\\267');
    expect(pdfString('Recycling Heroes™')).toContain('\\231');
    expect(pdfString('a — b')).not.toContain('?');
  });

  it('builds a Form 6 letterhead without replacement characters', () => {
    const buf = buildTextPdf(
      'FORM 6 — MANIFEST FOR E-WASTE',
      'E-Waste (Management) Rules, 2022 · Rule 12 · one manifest per invoice',
      [
        {
          heading: 'CONSIGNMENT',
          pairs: [
            ['Manifest Number', 'F6-00124', 'Processing Date', '2026-08-16'],
            ['Request ID', 'REQ-00059', 'Invoice Number', 'INV-E2E-948294'],
          ],
        },
        {
          heading: 'MATERIAL RECOVERY',
          table: {
            headers: ['Fraction', 'Wt (kg)', 'Share %'],
            rows: [['Ferrous metals', '34.5', '46.0%']],
            aligns: ['l', 'r', 'r'],
            colWeights: [2.6, 1.1, 1.0],
          },
        },
      ],
      'Form 6 manifest F6-00124 · Invoice INV-E2E-948294 · Urbeno Private Limited',
      {
        name: 'Urbeno Private Limited',
        brand: 'Recycling Heroes',
        address: 'Bengaluru, Karnataka, India',
        gst: '29AACCU6342E1ZB',
        cin: 'U72900KA2020PTC136643',
        phone: '1800-123-4433',
        email: 'info@urbeno.in',
        cpcb: 'CPCB/EPR/2022/KA/00817',
        kspcb: 'KSPCB/HWM/AUTH/2024-27/1142',
        docNo: 'F6-00124',
        docDate: '2026-08-17',
      },
    );

    const latin1 = buf.toString('latin1');
    expect(latin1.startsWith('%PDF-1.4')).toBe(true);
    expect(latin1).toContain('Urbeno Private Limited');
    expect(latin1).toContain('FORM 6');
    expect(latin1).toContain('F6-00124');
    expect(latin1).toContain('CONSIGNMENT');
    expect(latin1).toContain('/WinAnsiEncoding');
    expect(latin1).toContain('Page 1 of 1');
  });

  it('keeps every Form 6 table header intact and phones on one line', () => {
    const buf = buildTextPdf(
      'FORM 6 — MANIFEST FOR E-WASTE',
      'layout regression',
      [
        {
          heading: 'TRANSPORTER / VEHICLES ON THIS MANIFEST',
          table: {
            headers: ['Vehicle', 'Driver', 'Phone', 'Net (kg)', 'Slip No.'],
            rows: [['KA-02-INV-2026', 'Invoice Demo Driver', '+91 99001 00003', '1,200', 'WB-DEMO-048']],
            aligns: ['l', 'l', 'l', 'r', 'l'],
            colWeights: [1.15, 1.35, 1.35, 0.85, 1.1],
          },
        },
        {
          heading: 'E-WASTE CATEGORIES PROCESSED (SCHEDULE I)',
          table: {
            headers: ['Entry ID', 'Description', 'Group', 'Wt (kg)'],
            rows: [['REC-ITEW21', 'Scanners', 'ITEW', '1,000']],
            total: ['TOTAL', '', '', '1,000'],
            aligns: ['l', 'l', 'l', 'r'],
            colWeights: [1.05, 2.55, 0.7, 0.9],
          },
        },
        {
          heading: 'MATERIAL RECOVERY',
          table: {
            headers: ['Fraction', 'Wt (kg)', 'Share %'],
            rows: [
              ['Ferrous metals', '420', '42.0%'],
              ['Printed circuit boards', '90', '9.0%'],
            ],
            total: ['TOTAL RECOVERED', '1,000', '100.0%'],
            aligns: ['l', 'r', 'r'],
            colWeights: [2.6, 1.1, 1.0],
          },
        },
      ],
      'footer',
      { name: 'Urbeno Private Limited', variant: 'document' },
    );

    const texts = pdfTexts(buf);
    for (const h of [
      'VEHICLE',
      'DRIVER',
      'PHONE',
      'NET (KG)',
      'SLIP NO.',
      'ENTRY ID',
      'DESCRIPTION',
      'GROUP',
      'WT (KG)',
      'FRACTION',
      'SHARE %',
    ]) {
      expect(texts).toContain(h);
    }
    expect(texts).toContain('+91 99001 00003');
    expect(texts).not.toContain('+91 99001');
    expect(texts).toContain('WB-DEMO-048');
    expect(texts).toContain('100.0%');
    expect(texts).toContain('TOTAL RECOVERED');
  });

  it('wraps long pair values instead of truncating at 52 characters', () => {
    const longAddr =
      'Plot 47, KIADB Aerospace Park, Devanahalli, Bengaluru Rural, Karnataka 562110, India — Gate B';
    const buf = buildTextPdf(
      'MATERIAL RECEIPT NOTE',
      'Receiving facility test',
      [
        {
          heading: 'RECEIVING FACILITY',
          pairs: [
            ['Facility address', longAddr],
            [
              'CPCB / EPR Authorisation',
              'CPCB/EPR/2022/KA/00817',
              'State PCB Consent',
              'KSPCB/HWM/AUTH/2024-27/1142',
            ],
          ],
        },
      ],
      'MRN test footer',
      {
        name: 'Urbeno Private Limited',
        address: longAddr,
        variant: 'document',
      },
    );

    const latin1 = buf.toString('latin1');
    expect(latin1).toContain('Devanahalli');
    expect(latin1).toContain('562110');
    expect(latin1).toContain('Gate B');
  });
});
