import { describe, expect, it } from 'vitest';
import { findClientSerialDuplicates } from './duplicate-service.js';

describe('duplicate-service helpers', () => {
  it('exports serial duplicate finder', () => {
    expect(typeof findClientSerialDuplicates).toBe('function');
  });
});
