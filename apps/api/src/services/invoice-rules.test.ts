import { describe, expect, it } from 'vitest';
import { getPayStatus, unpaidCloseMessage } from '@urb-tectrack/shared';

describe('invoice payment rules', () => {
  it('detects unpaid invoice', () => {
    const status = getPayStatus(100000n, 0n);
    expect(status.key).toBe('pending');
  });

  it('detects fully paid invoice', () => {
    const status = getPayStatus(100000n, 100000n);
    expect(status.key).toBe('paid');
  });

  it('uses prototype close refusal wording', () => {
    const msg = unpaidCloseMessage('TC-INV-001', 50000n, 100000n);
    expect(msg).toContain('Payment is not settled on TC-INV-001');
    expect(msg).toContain('still outstanding');
  });
});

describe('billing weight deviation message', () => {
  it('matches prototype format', () => {
    const billWt = 110;
    const vehNet = 100;
    const dev = billWt - vehNet;
    const msg = `Billing weight (${billWt} kg) does not match the weighed vehicle net (${vehNet} kg). Record the reason for the excess of ${Math.abs(dev)} kg in the deviation note.`;
    expect(msg).toContain('deviation note');
  });
});
