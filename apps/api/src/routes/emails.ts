import type { FastifyInstance } from 'fastify';
import { attachSession, requireAdmin } from '../middleware/session.js';
import { listEmailOutbox } from '../services/email.js';

export async function emailsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/emails/outbox', { preHandler: requireAdmin }, async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 50);
    return listEmailOutbox(Math.min(limit, 200));
  });
}
