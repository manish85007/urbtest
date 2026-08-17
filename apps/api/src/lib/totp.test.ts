import { describe, expect, it } from 'vitest';
import { newTotpSecret, totpCode, totpUri, verifyTotp } from './totp.js';

describe('TOTP X3', () => {
  it('issues a base32 secret and a 6-digit code', () => {
    const secret = newTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(totpCode(secret)).toMatch(/^\d{6}$/);
  });

  it('accepts the current step and rejects a dummy code', () => {
    const secret = newTotpSecret();
    expect(verifyTotp(secret, totpCode(secret))).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('builds an otpauth URI', () => {
    const uri = totpUri('admin@urbeno.in', 'MFRGGZDFMZTWQ2LK');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('Urb');
  });
});
