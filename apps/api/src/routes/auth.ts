import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import {
  signIn,
  signOut,
  changePassword,
  AuthError,
  startMfaEnrol,
  confirmMfaEnrol,
  disableMfa,
  mfaStatus,
  securityStatusFor,
} from '../services/auth.js';
import { confirmPasswordReset, requestPasswordReset } from '../services/password-reset.js';
import { assertCaptcha, getCaptchaConfig, issueChallenge } from '../services/captcha.js';
import { attachSession, requireAuth, SESSION_COOKIE } from '../middleware/session.js';
import { isSecureDeployment } from '../lib/http-headers.js';
import { isAppError } from '../lib/errors.js';
import { bumpRateLimit } from '../lib/rate-limit-store.js';

const captchaFields = {
  turnstileToken: z.string().optional(),
  challengeToken: z.string().optional(),
  challengeAnswer: z.string().optional(),
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
  emailOtp: z.string().optional(),
  ...captchaFields,
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = isSecureDeployment() && process.env.E2E_TEST !== 'true' ? 10 : 1000;

const RESET_IP_WINDOW_MS = 15 * 60 * 1000;
const RESET_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_IP = isSecureDeployment() && process.env.E2E_TEST !== 'true' ? 10 : 100;
const RESET_MAX_PER_EMAIL = isSecureDeployment() && process.env.E2E_TEST !== 'true' ? 3 : 20;

async function checkLoginRateLimit(ip: string) {
  await bumpRateLimit(
    `login:ip:${ip}`,
    LOGIN_WINDOW_MS,
    LOGIN_MAX_PER_IP,
    'Too many sign-in attempts from this network. Try again later.',
  );
}

async function checkResetRateLimit(ip: string, email: string) {
  await bumpRateLimit(
    `reset:ip:${ip}`,
    RESET_IP_WINDOW_MS,
    RESET_MAX_PER_IP,
    'Too many password-reset requests from this network. Try again later.',
  );
  await bumpRateLimit(
    `reset:email:${email.trim().toLowerCase()}`,
    RESET_EMAIL_WINDOW_MS,
    RESET_MAX_PER_EMAIL,
    'Too many password-reset requests for this email. Try again later.',
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/auth/captcha', async () => {
    const cfg = getCaptchaConfig();
    if (cfg.provider === 'challenge') {
      const issued = issueChallenge();
      return {
        provider: cfg.provider,
        required: cfg.required,
        challengeToken: issued.token,
        question: issued.question,
      };
    }
    return {
      provider: cfg.provider,
      required: cfg.required,
      ...(cfg.siteKey ? { siteKey: cfg.siteKey } : {}),
    };
  });

  app.post('/auth/login', async (request, reply) => {
    try {
      await checkLoginRateLimit(request.ip);
      const body = loginSchema.parse(request.body);
      // Skip captcha on MFA / email-OTP continuation (already passed on first step).
      const continuing = !!body.mfaCode?.trim() || !!body.emailOtp?.trim();
      if (!continuing) {
        const captchaErr = await assertCaptcha({
          turnstileToken: body.turnstileToken,
          challengeToken: body.challengeToken,
          challengeAnswer: body.challengeAnswer,
          remoteIp: request.ip,
        });
        if (captchaErr) {
          return reply.status(400).send({
            message: captchaErr,
            error: 'Bad Request',
            statusCode: 400,
            captchaRequired: true,
          });
        }
      }
      const { user, token, security } = await signIn(
        body.email,
        body.password,
        body.mfaCode,
        request.headers['user-agent'],
        body.emailOtp,
      );
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.COOKIE_SECURE === 'true' ||
          (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
        maxAge: 8 * 60 * 60,
      });
      return { user, security };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          message: err.issues[0]?.message ?? 'Email and password are required.',
          error: 'Bad Request',
          statusCode: 400,
        });
      }
      if (isAppError(err) && err.statusCode === 429) {
        return reply.status(429).send({ message: err.message, error: 'Too Many Requests', statusCode: 429 });
      }
      const message = err instanceof Error ? err.message : 'Login failed';
      const mfaRequired = err instanceof AuthError && err.mfaRequired;
      const mfaMethod = err instanceof AuthError ? err.mfaMethod : null;
      const emailOtpRequired = err instanceof AuthError && err.emailOtpRequired;
      const demoCode = err instanceof AuthError ? err.demoCode : undefined;
      return reply.status(400).send({
        message,
        error: 'Bad Request',
        statusCode: 400,
        mfaRequired,
        ...(mfaMethod ? { mfaMethod } : {}),
        emailOtpRequired,
        ...(demoCode !== undefined ? { demoCode } : {}),
      });
    }
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await signOut(token, request.user!);
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.COOKIE_SECURE === 'true' ||
        (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
    });
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    const security = await securityStatusFor(request.user!);
    return { user: request.user, security };
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
    try {
      const body = z
        .object({
          email: z.string().email(),
          ...captchaFields,
        })
        .parse(request.body);
      await checkResetRateLimit(request.ip, body.email);
      const captchaErr = await assertCaptcha({
        turnstileToken: body.turnstileToken,
        challengeToken: body.challengeToken,
        challengeAnswer: body.challengeAnswer,
        remoteIp: request.ip,
      });
      if (captchaErr) {
        return reply.status(400).send({
          message: captchaErr,
          error: 'Bad Request',
          statusCode: 400,
          captchaRequired: true,
        });
      }
      return await requestPasswordReset(body.email);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          message: err.issues[0]?.message ?? 'A valid email is required.',
          error: 'Bad Request',
          statusCode: 400,
        });
      }
      if (isAppError(err) && err.statusCode === 429) {
        return reply.status(429).send({ message: err.message, error: 'Too Many Requests', statusCode: 429 });
      }
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

  app.post('/auth/mfa/start', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({ method: z.enum(['totp', 'email']).optional() })
      .parse(request.body ?? {});
    try {
      return await startMfaEnrol(request.user!, body.method ?? 'totp');
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Could not start enrolment');
    }
  });

  app.post('/auth/mfa/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        method: z.enum(['totp', 'email']).optional(),
        secret: z.string().optional(),
        code: z.string().min(6),
      })
      .parse(request.body);
    try {
      return await confirmMfaEnrol(request.user!, {
        method: body.method ?? 'totp',
        secret: body.secret,
        code: body.code,
      });
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
