import { afterEach, describe, expect, it } from 'vitest';
import { emailOtpDue, shouldRequireLoginEmailOtp } from './login-email-otp.js';

describe('login email OTP gating', () => {
  const prev = {
    e2e: process.env.E2E_TEST,
    nodeEnv: process.env.NODE_ENV,
    disabled: process.env.EMAIL_OTP_DISABLED,
  };

  afterEach(() => {
    process.env.E2E_TEST = prev.e2e;
    process.env.NODE_ENV = prev.nodeEnv;
    process.env.EMAIL_OTP_DISABLED = prev.disabled;
  });

  it('is due when the mailbox has never been verified', () => {
    process.env.E2E_TEST = 'false';
    process.env.NODE_ENV = 'uat';
    delete process.env.EMAIL_OTP_DISABLED;
    expect(emailOtpDue(null)).toBe(true);
    expect(emailOtpDue(undefined)).toBe(true);
  });

  it('skips the mailbox OTP on first login with a temporary password', () => {
    process.env.E2E_TEST = 'false';
    process.env.NODE_ENV = 'uat';
    delete process.env.EMAIL_OTP_DISABLED;
    expect(
      shouldRequireLoginEmailOtp({
        emailVerifiedAt: null,
        mustReset: true,
      }),
    ).toBe(false);
  });

  it('skips the mailbox OTP after email MFA already proved the mailbox', () => {
    process.env.E2E_TEST = 'false';
    process.env.NODE_ENV = 'uat';
    delete process.env.EMAIL_OTP_DISABLED;
    expect(
      shouldRequireLoginEmailOtp({
        emailVerifiedAt: null,
        emailMfaVerifiedThisLogin: true,
      }),
    ).toBe(false);
  });

  it('still requires the mailbox OTP for enrolled users without a forced password change', () => {
    process.env.E2E_TEST = 'false';
    process.env.NODE_ENV = 'uat';
    delete process.env.EMAIL_OTP_DISABLED;
    expect(
      shouldRequireLoginEmailOtp({
        emailVerifiedAt: null,
        mustReset: false,
        passwordExpired: false,
      }),
    ).toBe(true);
  });
});
