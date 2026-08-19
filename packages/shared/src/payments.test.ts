import { describe, expect, it } from 'vitest';
import { getPayStatus, settledPaise } from './payments.js';

describe('payments', () => {
  it('flags partial payment', () => {
    expect(getPayStatus(10000n, 5000n).key).toBe('partial');
  });

  it('treats TDS plus the transferred amount as settled', () => {
    expect(
      settledPaise([
        { amountPaise: 980000n, tdsPaise: 20000n },
      ]),
    ).toBe(1000000n);
    expect(getPayStatus(1000000n, 1000000n).key).toBe('paid');
  });
});
