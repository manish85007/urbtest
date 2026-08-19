import './lib/load-env.js';
import { initSentry } from './lib/sentry.js';
await initSentry(); // must run before buildApp so Fastify integrations are captured
import { buildApp } from './app.js';
import { disconnectDb } from './lib/prisma.js';

// ── Production safety guards ──────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

const SESSION_SECRET = process.env.SESSION_SECRET ?? '';
if (isProd && SESSION_SECRET.length < 32) {
  console.error(
    '[FATAL] SESSION_SECRET is missing or too short (need ≥ 32 chars). ' +
      'Set it via environment injection before starting in production.',
  );
  process.exit(1);
}

if (isProd && SESSION_SECRET === 'change-me-in-production-use-32-chars-min') {
  console.error(
    '[FATAL] SESSION_SECRET is still set to the default placeholder. ' +
      'Generate a secure random value (e.g. openssl rand -hex 32) and inject it at runtime.',
  );
  process.exit(1);
}

if (isProd && !process.env.CORS_ORIGIN) {
  console.warn(
    '[WARN] CORS_ORIGIN is not set. Defaulting to http://localhost:5173 which will ' +
      'block all cross-origin requests in production. Set CORS_ORIGIN to your frontend URL.',
  );
}

if (isProd && process.env.UAT_SEED === 'true') {
  console.error(
    '[FATAL] UAT_SEED=true is set in a production environment. ' +
      'This would overwrite production data. Remove UAT_SEED or set it to false.',
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await disconnectDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
