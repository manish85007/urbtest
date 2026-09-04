import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { mastersRoutes } from './routes/masters.js';
import { filesRoutes } from './routes/files.js';
import { emailsRoutes } from './routes/emails.js';
import { adminRoutes } from './routes/admin.js';
import { reportsRoutes } from './routes/reports.js';
import { legalRoutes, auditRoutes, registerSecurityHeaders } from './routes/legal.js';
import { searchRoutes } from './routes/search.js';
import { complianceRoutes } from './routes/compliance.js';
import { jobsRoutes } from './routes/jobs.js';
import { startScheduler } from './jobs/scheduler.js';
import { prisma } from './lib/prisma.js';
import { captureException } from './lib/sentry.js';
import { registerCsrfProtection } from './middleware/csrf.js';
import {
  HTML_CACHE_CONTROL,
  cacheControlForPath,
  isSecureDeployment,
} from './lib/http-headers.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  app.setErrorHandler((err: { statusCode?: number; message?: string }, _request, reply) => {
    const code = (err as { statusCode?: number }).statusCode ?? 500;
    // Report unexpected 5xx errors to Sentry; skip known operational errors
    if (code >= 500) {
      captureException(err, { url: _request.url, method: _request.method });
    }
    return reply.status(code).send({ message: (err as { message?: string }).message ?? 'Internal server error' });
  });

  await app.register(compress, {
    global: true,
    threshold: 256,
    encodings: ['br', 'gzip'],
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.register(cookie);
  await app.register(sensible);

  // General API rate limit — auth routes apply stricter per-route limits.
  // Skipped in unit tests / Playwright e2e to avoid flaky suites.
  if (process.env.E2E_TEST !== 'true' && process.env.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      global: true,
      max: isSecureDeployment() ? 120 : 1000,
      timeWindow: '1 minute',
      allowList: (req) => {
        const path = req.url.split('?')[0] ?? '';
        return path === '/health' || path.startsWith('/internal/jobs');
      },
      errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      }),
    });
  }

  registerSecurityHeaders(app);
  registerCsrfProtection(app);

  app.addHook('onSend', async (request, reply, payload) => {
    // Do not advertise the app server stack (Cloud Run GFE may still set its own).
    reply.removeHeader('Server');

    if (request.method === 'GET' || request.method === 'HEAD') {
      const path = request.url.split('?')[0] || '/';
      if (path === '/' || path.endsWith('.html')) {
        reply.header('Cache-Control', HTML_CACHE_CONTROL);
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
      } else if (path.startsWith('/assets/')) {
        const cache = cacheControlForPath(path);
        if (cache) reply.header('Cache-Control', cache);
      }
    }
    return payload;
  });

  app.addHook('preSerialization', async (_request, _reply, payload) => {
    if (payload === undefined || payload === null) return payload;
    return JSON.parse(
      JSON.stringify(payload, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  });

  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, service: 'urb-tectrack-api', version: '0.1.0', db: 'ok' };
    } catch {
      return reply.status(503).send({ ok: false, service: 'urb-tectrack-api', db: 'unreachable' });
    }
  });

  await app.register(authRoutes);
  await app.register(submissionRoutes);
  await app.register(lifecycleRoutes);
  await app.register(mastersRoutes);
  await app.register(filesRoutes);
  await app.register(emailsRoutes);
  await app.register(adminRoutes);
  await app.register(reportsRoutes);
  await app.register(legalRoutes);
  await app.register(auditRoutes);
  await app.register(searchRoutes);
  await app.register(complianceRoutes);
  await app.register(jobsRoutes);

  // Inline setInterval jobs — fine for long-lived processes / UAT.
  // On Cloud Run, prefer ENABLE_JOBS=false + Cloud Scheduler → POST /internal/jobs/*
  // with Authorization: Bearer $JOBS_SECRET so work continues when instances scale to zero.
  if (process.env.ENABLE_JOBS !== 'false') {
    startScheduler(app);
  }

  const webDist = process.env.WEB_DIST?.trim();
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: resolve(webDist),
      wildcard: false,
      // Avoid @fastify/send default `public, max-age=0` on HTML — we set headers below.
      cacheControl: false,
      setHeaders(reply, filePath) {
        const cache = cacheControlForPath(filePath);
        if (cache) {
          reply.header('Cache-Control', cache);
          if (cache.includes('no-store')) {
            reply.header('Pragma', 'no-cache');
            reply.header('Expires', '0');
          }
        }
        reply.removeHeader('Server');
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' || request.method === 'HEAD') {
        reply.removeHeader('Server');
        reply.header('Cache-Control', HTML_CACHE_CONTROL);
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ message: 'Not found' });
    });
  }

  return app;
}
