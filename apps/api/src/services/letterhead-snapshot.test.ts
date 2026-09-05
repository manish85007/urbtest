import { describe, expect, it } from 'vitest';
import { parseLetterheadSnapshot } from '../services/letterhead-snapshot.js';

describe('parseLetterheadSnapshot', () => {
  it('accepts a full snapshot', () => {
    const snap = parseLetterheadSnapshot({
      capturedAt: '2026-09-05T10:00:00.000Z',
      company: {
        name: 'Urbeno Private Limited',
        brand: 'Recycling Heroes',
        address: 'Bengaluru',
        gst: '29AABCU1234R1ZX',
        pan: 'AABCU1234R',
        cin: 'U123',
        phone: '1800-OLD',
        email: 'info@urbeno.in',
        cpcb: 'CPCB/OLD',
        kspcb: 'KSPCB/OLD',
        r2: '',
        logoFileId: null,
      },
      factory: {
        id: 'URB-ASP1',
        name: 'Aerospace Park',
        address: 'Devanahalli',
        gstin: '29AAA',
        kspcbConsent: 'K1',
        cpcbEpr: 'C1',
      },
    });
    expect(snap?.company.phone).toBe('1800-OLD');
    expect(snap?.factory.id).toBe('URB-ASP1');
  });

  it('rejects incomplete snapshots so PDFs fall back to live Masters', () => {
    expect(parseLetterheadSnapshot(null)).toBeNull();
    expect(parseLetterheadSnapshot({ company: { name: 'X' } })).toBeNull();
  });
});
