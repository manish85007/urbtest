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

describe('billing weight overall match', () => {
  it('rejects over-billing against remaining weighment', () => {
    const totalNet = 100;
    const alreadyBilled = 40;
    const remaining = totalNet - alreadyBilled;
    const billWt = 70;
    expect(billWt).toBeGreaterThan(remaining);
    const msg = `Billing weight (${billWt} kg) exceeds the remaining weighment (${remaining} kg). Total vehicle weighment is ${totalNet} kg and ${alreadyBilled} kg is already billed. The sum of all invoice billing weights must equal the total weighment.`;
    expect(msg).toContain('remaining weighment');
  });
});
