import { describe, expect, it } from 'vitest';
import { getPayStatus } from './payments.js';

describe('payments', () => {
  it('flags partial payment', () => {
    expect(getPayStatus(10000n, 5000n).key).toBe('partial');
  });
});
