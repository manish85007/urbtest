import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
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
import { startScheduler } from './jobs/scheduler.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
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

  app.get('/health', async () => ({
    ok: true,
    service: 'urb-tectrack-api',
    version: '0.1.0',
  }));

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

  if (process.env.ENABLE_JOBS !== 'false') {
    startScheduler(app);
  }

  return app;
}
