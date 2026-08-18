import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signIn, signOut, changePassword, AuthError, startMfaEnrol, confirmMfaEnrol, disableMfa, mfaStatus } from '../services/auth.js';
import { confirmPasswordReset, requestPasswordReset } from '../services/password-reset.js';
import { attachSession, requireAuth, SESSION_COOKIE } from '../middleware/session.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP =
  process.env.NODE_ENV === 'production' && process.env.E2E_TEST !== 'true' ? 30 : 1000;
const ipLoginCounts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string) {
  if (process.env.E2E_TEST === 'true' || process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  const rec = ipLoginCounts.get(ip) ?? { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + LOGIN_WINDOW_MS;
  }
  rec.count += 1;
  ipLoginCounts.set(ip, rec);
  if (rec.count > LOGIN_MAX_PER_IP) {
    throw new Error('Too many sign-in attempts from this network. Try again later.');
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.post('/auth/login', async (request, reply) => {
    checkLoginRateLimit(request.ip);
    const body = loginSchema.parse(request.body);
    try {
      const { user, token } = await signIn(body.email, body.password, body.mfaCode, request.headers['user-agent']);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.COOKIE_SECURE === 'true' ||
          (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
        maxAge: 8 * 60 * 60,
      });
      return { user };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      const mfaRequired = err instanceof AuthError && err.mfaRequired;
      return reply.status(400).send({ message, error: 'Bad Request', statusCode: 400, mfaRequired });
    }
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await signOut(token, request.user!);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    return { user: request.user };
  });

  app.post('/auth/change-password', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(1),
      })
      .parse(request.body);
    try {
      return await changePassword(request.user!, body.currentPassword, body.newPassword);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Password change failed');
    }
  });

  app.post('/auth/reset/request', async (request, reply) => {
    const body = z.object({ email: z.string().email() }).parse(request.body);
    try {
      return await requestPasswordReset(body.email);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Reset request failed');
    }
  });

  app.post('/auth/reset', async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        code: z.string().min(4),
        newPassword: z.string().min(1),
      })
      .parse(request.body);
    try {
      return await confirmPasswordReset(body.email, body.code, body.newPassword);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Reset failed');
    }
  });

  app.get('/auth/mfa', { preHandler: requireAuth }, async (request) => mfaStatus(request.user!));

  app.post('/auth/mfa/start', { preHandler: requireAuth }, async (request) => startMfaEnrol(request.user!));

  app.post('/auth/mfa/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.object({ secret: z.string().min(8), code: z.string().min(6) }).parse(request.body);
    try {
      return await confirmMfaEnrol(request.user!, body.secret, body.code);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Enrolment failed');
    }
  });

  app.post('/auth/mfa/disable', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.object({ reason: z.string() }).parse(request.body);
    try {
      return await disableMfa(request.user!, body.reason);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Could not remove second factor');
    }
  });
}
