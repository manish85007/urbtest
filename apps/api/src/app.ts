import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { lifecycleRoutes } from './routes/lifecycle.js';

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

  app.get('/health', async () => ({
    ok: true,
    service: 'urb-tectrack-api',
    version: '0.1.0',
  }));

  await app.register(authRoutes);
  await app.register(submissionRoutes);
  await app.register(lifecycleRoutes);

  return app;
}
