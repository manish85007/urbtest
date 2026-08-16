import type { FastifyInstance } from 'fastify';
import { attachSession, requireAuth } from '../middleware/session.js';
import { getReportsForActor } from '../services/reporting-service.js';

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/reports/dashboard', { preHandler: requireAuth }, async (request) => {
    const { siteId } = request.query as { siteId?: string };
    return getReportsForActor(request.user!, siteId);
  });
}
