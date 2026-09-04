import { describe, expect, it } from 'vitest';
import {
  MFA_GRACE_DAYS,
  PW_POLICY,
  mfaEnrolForced,
  mfaGraceDaysLeft,
  pwCheck,
  pwExpired,
  pwPolicyText,
} from './password-policy.js';

describe('password policy X4', () => {
  it('requires at least 10 characters', () => {
    expect(PW_POLICY.minLen).toBeGreaterThanOrEqual(10);
    expect(pwCheck('short', 'admin@urbeno.in').length).toBeGreaterThan(0);
  });

  it('requires mixed case', () => {
    expect(pwCheck('alllowercase123', 'admin@urbeno.in').length).toBeGreaterThan(0);
  });

  it('accepts a policy-compliant password', () => {
    expect(pwCheck('GoodPassw0rd', 'admin@urbeno.in')).toEqual([]);
  });

  it('refuses a password that contains the email local-part', () => {
    expect(pwCheck('Ramesh12345', 'ramesh@techcorp.in').length).toBeGreaterThan(0);
  });

  it('describes the policy in operator language', () => {
    expect(pwPolicyText()).toMatch(/10 characters/);
    expect(pwPolicyText()).toMatch(/last 5 passwords/);
  });

  it('treats a missing set-date as not expired', () => {
    expect(pwExpired(null)).toBe(false);
  });

  it('expires after 180 days', () => {
    const old = new Date(Date.now() - 181 * 86400000);
    expect(pwExpired(old)).toBe(true);
  });

  it(`forces MFA after ${MFA_GRACE_DAYS} days for staff who have not enrolled`, () => {
    const within = new Date(Date.now() - 3 * 86400000);
    expect(mfaEnrolForced('admin', within, false)).toBe(false);
    expect(mfaGraceDaysLeft('admin', within, false)).toBe(MFA_GRACE_DAYS - 3);

    const overdue = new Date(Date.now() - (MFA_GRACE_DAYS + 1) * 86400000);
    expect(mfaEnrolForced('admin', overdue, false)).toBe(true);
    expect(mfaEnrolForced('admin', overdue, true)).toBe(false);
    expect(mfaEnrolForced('client', overdue, false)).toBe(false);
  });
});
