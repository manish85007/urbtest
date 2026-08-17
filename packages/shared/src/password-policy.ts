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

export const MFA_ROLES = ['admin', 'factory'] as const;

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
