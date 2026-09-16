import { describe, expect, it } from 'vitest';

/** Mirrors registerCsrfProtection origin allow-list assembly. */
function allowedOrigins(env: { CORS_ORIGIN?: string; PORTAL_URL?: string }): string[] {
  return [
    ...(env.CORS_ORIGIN ?? '').split(','),
    env.PORTAL_URL ?? '',
  ]
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

describe('CSRF origin allow-list', () => {
  it('allows the public portal even when CORS_ORIGIN points at run.app', () => {
    const allowed = allowedOrigins({
      CORS_ORIGIN: 'https://tectrack-uat-t6w4h7d3fa-el.a.run.app',
      PORTAL_URL: 'https://uat.urbeno.in',
    });
    expect(allowed).toContain('https://uat.urbeno.in');
    expect(allowed).toContain('https://tectrack-uat-t6w4h7d3fa-el.a.run.app');
  });

  it('trims trailing slashes so portal URLs match browser Origin', () => {
    const allowed = allowedOrigins({
      CORS_ORIGIN: 'https://uat.urbeno.in/',
      PORTAL_URL: 'https://uat.urbeno.in/',
    });
    expect(allowed).toEqual(['https://uat.urbeno.in']);
  });
});
