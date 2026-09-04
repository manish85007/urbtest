import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/errors.js';

/** Custom header browsers cannot set on simple cross-origin form posts. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'UrbTecTrack';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that must stay callable without the CSRF header (login bootstrap, public legal, jobs). */
const CSRF_EXEMPT_PREFIXES = [
  '/health',
  '/auth/login',
  '/auth/captcha',
  '/auth/reset',
  '/legal-documents',
  '/internal/jobs',
];

function isExempt(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return CSRF_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Mitigate cookie-authenticated CSRF: require a custom header on mutating requests.
 * Same-origin SPA fetch sets the header; classic cross-site form posts cannot.
 */
export function registerCsrfProtection(app: FastifyInstance) {
  if (process.env.CSRF_PROTECTION === 'false') return;
  if (process.env.E2E_TEST === 'true' || process.env.NODE_ENV === 'test') {
    // Still enforce in UAT when E2E_TEST is set only if CSRF_PROTECTION=true explicitly.
    if (process.env.CSRF_PROTECTION !== 'true') return;
  }

  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (isExempt(request.url)) return;

    const header = String(request.headers[CSRF_HEADER] ?? '').trim();
    if (header !== CSRF_HEADER_VALUE) {
      throw new AppError('Missing or invalid CSRF header.', 403);
    }

    // Extra Origin/Referer check when present (browser navigation / fetch).
    const origin = request.headers.origin;
    const allowed = (process.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && allowed.length && !allowed.includes(origin)) {
      throw new AppError('Cross-origin request blocked.', 403);
    }
  });
}
