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
        email: 'ops@urbeno.in',
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

  it('prints the invoice number on a document-style MRN letterhead', () => {
    const buf = buildTextPdf(
      'MATERIAL RECEIPT NOTE',
      'Linked to invoice INV-1 · Request REQ-1 · one MRN per invoice',
      [
        {
          heading: 'REFERENCE',
          pairs: [['Invoice Number', 'INV-1', 'Invoice Date', '2026-08-16']],
        },
      ],
      'MRN/URB-BLR/26-27/0001 · Invoice INV-1',
      {
        name: 'Urbeno Private Limited',
        docNo: 'MRN/URB-BLR/26-27/0001',
        docLabel: 'Invoice INV-1',
        docDate: '2026-08-16',
        variant: 'document',
        logoMaxWidth: 155,
        logoMaxHeight: 38,
      },
    );

    const latin1 = buf.toString('latin1');
    expect(latin1.startsWith('%PDF-1.4')).toBe(true);
    expect(latin1).toContain('Invoice INV-1');
    expect(latin1).toContain('MATERIAL RECEIPT NOTE');
    expect(latin1).toContain('MRN/URB-BLR/26-27/0001');
  });
});
