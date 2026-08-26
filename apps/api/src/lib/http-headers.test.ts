import { describe, expect, it } from 'vitest';
import { contentDisposition } from './http-headers.js';

describe('contentDisposition', () => {
  it('strips quotes, slashes, and non-ascii characters', () => {
    expect(contentDisposition('inline', 'growth “photo”.jpg')).toBe('inline; filename="growth _photo_.jpg"');
    expect(contentDisposition('attachment', 'F6/2627/0001.pdf')).toBe('attachment; filename="F6_2627_0001.pdf"');
  });

  it('falls back when empty', () => {
    expect(contentDisposition('inline', '')).toBe('inline; filename="download"');
  });
});
