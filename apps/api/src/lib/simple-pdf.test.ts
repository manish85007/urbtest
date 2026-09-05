import { describe, expect, it } from 'vitest';
import { buildTextPdf, pdfString } from '../lib/simple-pdf.js';

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
            headers: ['Fraction', 'Weight (kg)', 'Share'],
            rows: [['Ferrous metals', '34.5', '46.0%']],
            aligns: ['l', 'r', 'r'],
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
    expect(latin1).not.toContain('? CONSIGNMENT');
    expect(latin1).not.toContain('? MANIFEST');
    expect(latin1).not.toMatch(/\u00c2\u00b7/);
    expect(latin1).not.toMatch(/\u00e2\u0080\u0094/);
    expect(latin1).toContain('/WinAnsiEncoding');
    expect(latin1).toContain('Page 1 of 1');
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
            ['CPCB / EPR Authorisation', 'CPCB/EPR/2022/KA/00817', 'State PCB Consent', 'KSPCB/HWM/AUTH/2024-27/1142'],
          ],
        },
        {
          heading: 'CATEGORIES',
          table: {
            headers: ['Entry', 'Description', 'Group', 'Weight (kg)'],
            rows: [
              [
                'REC-ITEW2',
                'Personal Computing Devices: Personal Computers (Central Processing Unit with input and output devices)',
                'ITEW',
                '42.5',
              ],
            ],
            aligns: ['l', 'l', 'l', 'r'],
          },
        },
      ],
      'MRN test footer',
      {
        name: 'Urbeno Private Limited',
        address: longAddr,
        gst: '29AACCU6342E1ZB',
        cin: 'U72900KA2020PTC136643',
        phone: '+91 99022 99007',
        email: 'info@urbeno.in',
        cpcb: 'CPCB/EPR/2022/KA/00817',
        kspcb: 'KSPCB/HWM/AUTH/2024-27/1142',
        docNo: 'MRN/URB-ASP1/2627/0001',
        docLabel: 'Invoice INV-LONG-1',
        variant: 'document',
      },
    );

    const latin1 = buf.toString('latin1');
    expect(latin1).toContain('Devanahalli');
    expect(latin1).toContain('562110');
    expect(latin1).toContain('Central Processing Unit');
    expect(latin1).toContain('CPCB/EPR/2022/KA/00817');
    expect(latin1).toContain('KSPCB/HWM/AUTH/2024-27/1142');
    // Full pin must appear (old pair renderer sliced mid-value at 52 chars).
    expect(latin1).toContain('Bengaluru Rural, Karnataka 562110');
    expect(latin1).toContain('Gate B');
  });
});
