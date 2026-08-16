import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { attachSession, requireAuth } from '../middleware/session.js';
import {
  getCapacityReport,
  getHeroesReport,
  getRegisterReport,
  getReportsForActor,
  type RegisterType,
} from '../services/reporting-service.js';
import { recordTreePlanting } from '../services/tree-planting.js';

const registerTypes = ['summary', 'invoices', 'mrn', 'form6', 'cod'] as const;

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/reports/dashboard', { preHandler: requireAuth }, async (request) => {
    const { siteId } = request.query as { siteId?: string };
    return getReportsForActor(request.user!, siteId);
  });

  app.get('/reports/capacity', { preHandler: requireAuth }, async (request, reply) => {
    const { factoryId } = request.query as { factoryId?: string };
    if (!factoryId) return reply.badRequest('factoryId is required.');
    try {
      return await getCapacityReport(request.user!, factoryId);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Failed to load capacity');
    }
  });

  app.get('/reports/heroes', { preHandler: requireAuth }, async (request) => {
    return getHeroesReport(request.user!);
  });

  app.get('/reports/register/:type', { preHandler: requireAuth }, async (request, reply) => {
    const { type } = request.params as { type: string };
    if (!registerTypes.includes(type as RegisterType)) {
      return reply.badRequest(`Unknown register type: ${type}`);
    }
    try {
      return await getRegisterReport(request.user!, type as RegisterType);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Failed to load register');
    }
  });

  app.post('/reports/heroes/plantings', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        trees: z.number().int().positive(),
        plantedAt: z.string(),
        location: z.string().optional(),
        note: z.string().optional(),
        clientId: z.string().length(4).optional(),
      })
      .parse(request.body);
    try {
      return await recordTreePlanting(request.user!, body);
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Failed to record planting');
    }
  });
}
