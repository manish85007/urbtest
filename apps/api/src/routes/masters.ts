import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAuth } from '../middleware/session.js';
import { clientScopeFilter, isStaff } from '../lib/auth-context.js';

export async function mastersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/clients', { preHandler: requireAuth }, async (request) => {
    const actor = request.user!;
    if (isStaff(actor)) {
      return prisma.client.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, city: true },
      });
    }
    if (!actor.clientId) return [];
    const client = await prisma.client.findUnique({
      where: { id: actor.clientId },
      select: { id: true, name: true, city: true },
    });
    return client ? [client] : [];
  });

  app.get('/clients/:clientId/sites', { preHandler: requireAuth }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const actor = request.user!;

    if (!isStaff(actor) && actor.clientId !== clientId) {
      return reply.forbidden('Access denied.');
    }

    const sites = await prisma.site.findMany({
      where: { clientId, active: true },
      orderBy: { name: 'asc' },
    });

    if (!isStaff(actor) && actor.siteIds.length) {
      return sites.filter((s) => actor.siteIds.includes(s.id));
    }
    return sites;
  });

  app.get('/factories', { preHandler: requireAuth }, async (request) => {
    const actor = request.user!;
    const all = await prisma.factorySite.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    if (actor.role === 'factory') {
      return all.filter((f) => actor.factoryIds.includes(f.id));
    }
    return all;
  });

  app.get('/factories/:factoryId/categories', { preHandler: requireAuth }, async (request, reply) => {
    const { factoryId } = request.params as { factoryId: string };
    const actor = request.user!;

    if (actor.role === 'factory' && !actor.factoryIds.includes(factoryId)) {
      return reply.forbidden('Access denied.');
    }

    return prisma.categoryMaster.findMany({
      where: { factoryId, active: true },
      orderBy: [{ groupCode: 'asc' }, { entryId: 'asc' }],
      select: {
        id: true,
        entryId: true,
        description: true,
        groupCode: true,
        capacityTpa: true,
      },
    });
  });
}
