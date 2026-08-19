import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
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
import { startScheduler } from './jobs/scheduler.js';
import { prisma } from './lib/prisma.js';
import { captureException } from './lib/sentry.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((err: { statusCode?: number; message?: string }, _request, reply) => {
    const code = (err as { statusCode?: number }).statusCode ?? 500;
    // Report unexpected 5xx errors to Sentry; skip known operational errors
    if (code >= 500) {
      captureException(err, { url: _request.url, method: _request.method });
    }
    return reply.status(code).send({ message: (err as { message?: string }).message ?? 'Internal server error' });
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.register(cookie);
  await app.register(sensible);

  registerSecurityHeaders(app);

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

  if (process.env.ENABLE_JOBS !== 'false') {
    startScheduler(app);
  }

  const webDist = process.env.WEB_DIST?.trim();
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: resolve(webDist),
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET') {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ message: 'Not found' });
    });
  }

  return app;
}
