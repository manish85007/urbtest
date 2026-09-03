import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { isSecureDeployment } from '../lib/http-headers.js';

export type CaptchaProvider = 'turnstile' | 'challenge' | 'none';

export interface CaptchaConfig {
  provider: CaptchaProvider;
  required: boolean;
  siteKey?: string;
}

function signingSecret(): string {
  return (
    process.env.CAPTCHA_HMAC_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'dev-captcha-secret-change-me'
  );
}

/** Public captcha config for the login / reset UI. */
export function getCaptchaConfig(): CaptchaConfig {
  if (process.env.CAPTCHA_DISABLED === 'true' || process.env.E2E_TEST === 'true' || process.env.NODE_ENV === 'test') {
    return { provider: 'none', required: false };
  }
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (siteKey && secret) {
    return { provider: 'turnstile', required: true, siteKey };
  }
  // Always challenge on UAT/production even without Turnstile keys.
  if (isSecureDeployment()) {
    return { provider: 'challenge', required: true };
  }
  // Local/dev: optional challenge when CAPTCHA_REQUIRED=true
  if (process.env.CAPTCHA_REQUIRED === 'true') {
    return { provider: 'challenge', required: true };
  }
  return { provider: 'none', required: false };
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Issue a signed arithmetic challenge (stateless — works across multiple API instances). */
export function issueChallenge(): { token: string; question: string } {
  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  const answer = a + b;
  const exp = Date.now() + 5 * 60 * 1000;
  const payload = `${answer}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  return { token, question: `What is ${a} + ${b}?` };
}

export function verifyChallengeToken(token: string, answerRaw: string): boolean {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const [answerStr, expStr, sig] = parts;
  if (!answerStr || !expStr || !sig) return false;
  if (!safeEqualHex(sign(`${answerStr}.${expStr}`), sig)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = Number(answerStr);
  const given = Number(String(answerRaw).trim());
  if (!Number.isFinite(expected) || !Number.isFinite(given)) return false;
  return expected === given;
}

async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Verify captcha for login / password-reset.
 * Returns an error message when verification fails; null when OK / not required.
 */
export async function assertCaptcha(input: {
  turnstileToken?: string;
  challengeToken?: string;
  challengeAnswer?: string;
  remoteIp?: string;
}): Promise<string | null> {
  const cfg = getCaptchaConfig();
  if (!cfg.required) return null;

  if (cfg.provider === 'turnstile') {
    const token = input.turnstileToken?.trim();
    if (!token) return 'Complete the security check before continuing.';
    const ok = await verifyTurnstile(token, input.remoteIp);
    return ok ? null : 'Security check failed. Refresh and try again.';
  }

  if (cfg.provider === 'challenge') {
    if (!input.challengeToken?.trim() || input.challengeAnswer === undefined || input.challengeAnswer === '') {
      return 'Solve the security question before continuing.';
    }
    const ok = verifyChallengeToken(input.challengeToken, input.challengeAnswer);
    return ok ? null : 'Incorrect security answer. Refresh the question and try again.';
  }

  return null;
}
