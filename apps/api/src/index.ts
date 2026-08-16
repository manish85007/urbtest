import 'dotenv/config';
import { buildApp } from './app.js';
import { disconnectDb } from './lib/prisma.js';

const port = Number(process.env.API_PORT ?? 3001);
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
