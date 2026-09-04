/** X4 · Password rules — ISO 27001 A.5.17 / SOC 2 CC6.1 */

export const PW_POLICY = {
  minLen: 10,
  upper: true,
  lower: true,
  digit: true,
  symbol: false,
  historyDepth: 5,
  maxAgeDays: 180,
  lockAfter: 5,
  lockWindowMins: 15,
} as const;

/** Staff roles that must use a second factor (authenticator or email OTP). */
export const MFA_ROLES = ['admin', 'operations', 'factory'] as const;

/** Days after account creation before MFA enrolment is forced for MFA_ROLES. */
export const MFA_GRACE_DAYS = 15;

export function pwCheck(pw: string, em?: string | null): string[] {
  const p = PW_POLICY;
  const fails: string[] = [];
  if (!pw || pw.length < p.minLen) fails.push(`at least ${p.minLen} characters`);
  if (p.upper && !/[A-Z]/.test(pw)) fails.push('an upper-case letter');
  if (p.lower && !/[a-z]/.test(pw)) fails.push('a lower-case letter');
  if (p.digit && !/[0-9]/.test(pw)) fails.push('a digit');
  if (p.symbol && !/[^A-Za-z0-9]/.test(pw)) fails.push('a symbol');
  if (em && pw && pw.toLowerCase().includes(String(em).split('@')[0].toLowerCase())) {
    fails.push('something other than your own name or email');
  }
  return fails;
}

export function pwPolicyText(): string {
  const p = PW_POLICY;
  const bits = [`${p.minLen} characters or more`];
  if (p.upper) bits.push('an upper-case letter');
  if (p.lower) bits.push('a lower-case letter');
  if (p.digit) bits.push('a digit');
  if (p.symbol) bits.push('a symbol');
  return bits.join(', ') + `. It cannot repeat your last ${p.historyDepth} passwords.`;
}

export function pwNeedsMessage(fails: string[]): string {
  return 'Your new password needs ' + fails.join(', ') + '.';
}

export function pwReusedMessage(): string {
  return `That matches one of your last ${PW_POLICY.historyDepth} passwords. Choose one you have not used before.`;
}

export function pwAgeDays(passwordSetAt: Date | string | null | undefined, now = Date.now()): number | null {
  if (!passwordSetAt) return null;
  return Math.floor((now - new Date(passwordSetAt).getTime()) / 86400000);
}

export function pwExpired(
  passwordSetAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  const d = pwAgeDays(passwordSetAt, now);
  return d !== null && d > PW_POLICY.maxAgeDays;
}

export function mfaRequired(role: string | null | undefined): boolean {
  return (MFA_ROLES as readonly string[]).includes(role ?? '');
}

/** Whole days elapsed since account creation (floor). */
export function mfaAgeDays(createdAt: Date | string | null | undefined, now = Date.now()): number | null {
  if (!createdAt) return null;
  return Math.floor((now - new Date(createdAt).getTime()) / 86400000);
}

/** Days remaining in the MFA grace window; 0 when due or overdue; null if MFA not required for role. */
export function mfaGraceDaysLeft(
  role: string | null | undefined,
  createdAt: Date | string | null | undefined,
  enrolled: boolean,
  now = Date.now(),
): number | null {
  if (!mfaRequired(role) || enrolled) return null;
  const age = mfaAgeDays(createdAt, now);
  if (age === null) return MFA_GRACE_DAYS;
  return Math.max(0, MFA_GRACE_DAYS - age);
}

/** True when a staff account past the grace window must enrol MFA before using the app. */
export function mfaEnrolForced(
  role: string | null | undefined,
  createdAt: Date | string | null | undefined,
  enrolled: boolean,
  now = Date.now(),
): boolean {
  if (!mfaRequired(role) || enrolled) return false;
  const left = mfaGraceDaysLeft(role, createdAt, enrolled, now);
  return left !== null && left <= 0;
}
