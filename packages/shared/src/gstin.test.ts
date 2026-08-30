import { describe, expect, it } from 'vitest';
import { gstinError, isValidGstin, normalizeGstin, panFromGstin } from './gstin.js';

describe('gstin', () => {
  it('accepts a checksum-valid GSTIN', () => {
    expect(isValidGstin('29AABCU1234R1ZW')).toBe(true);
    expect(gstinError('29AABCU1234R1ZW')).toBeNull();
    expect(panFromGstin('29AABCU1234R1ZW')).toBe('AABCU1234R');
  });

  it('rejects bad check digit and format', () => {
    expect(gstinError('29AABCU1234R1ZX')).toMatch(/check digit/i);
    expect(gstinError('ABC')).toMatch(/15/);
    expect(normalizeGstin(' 29aabcu1234r1zw ')).toBe('29AABCU1234R1ZW');
  });
});
