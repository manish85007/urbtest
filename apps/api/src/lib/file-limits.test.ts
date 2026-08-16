import { describe, expect, it } from 'vitest';
import { isMimeAllowed, maxMbForKind } from '../lib/file-limits.js';

describe('file-limits', () => {
  it('applies prototype photo cap to weigh photos', () => {
    expect(maxMbForKind('weighPhoto')).toBe(5);
  });

  it('applies cod cap to certificates', () => {
    expect(maxMbForKind('certificate')).toBe(5);
  });

  it('rejects non-pdf for certificate', () => {
    expect(isMimeAllowed('certificate', 'image/jpeg')).toBe(false);
    expect(isMimeAllowed('certificate', 'application/pdf')).toBe(true);
  });
});
