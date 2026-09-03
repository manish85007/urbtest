import { describe, expect, it } from 'vitest';
import { getCaptchaConfig, issueChallenge, verifyChallengeToken } from '../services/captcha.js';

describe('challenge captcha', () => {
  it('issues a signed challenge that verifies with the correct answer', () => {
    const { token, question } = issueChallenge();
    expect(question).toMatch(/^What is \d+ \+ \d+\?$/);
    const m = question.match(/What is (\d+) \+ (\d+)\?/);
    expect(m).toBeTruthy();
    const answer = String(Number(m![1]) + Number(m![2]));
    expect(verifyChallengeToken(token, answer)).toBe(true);
    expect(verifyChallengeToken(token, '999')).toBe(false);
    expect(verifyChallengeToken('tampered.token.here', answer)).toBe(false);
  });
});

describe('getCaptchaConfig', () => {
  it('returns none when CAPTCHA_DISABLED', () => {
    const prev = process.env.CAPTCHA_DISABLED;
    process.env.CAPTCHA_DISABLED = 'true';
    try {
      expect(getCaptchaConfig()).toEqual({ provider: 'none', required: false });
    } finally {
      if (prev === undefined) delete process.env.CAPTCHA_DISABLED;
      else process.env.CAPTCHA_DISABLED = prev;
    }
  });
});
