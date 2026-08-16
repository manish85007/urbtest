import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAdmin, requireAuth } from '../middleware/session.js';
import { isStaff } from '../lib/auth-context.js';
import { isAppError } from '../lib/errors.js';
import { listLookups, upsertLookup } from '../services/lookups.js';
import {
  createClient,
  createSite,
  createUser,
  listUsers,
  updateClient,
  updateSite,
  updateUser,
  upsertCategory,
  upsertFactory,
} from '../services/masters-write.js';

function handleErr(err: unknown, reply: { badRequest: (m: string) => unknown; status: (n: number) => { send: (b: unknown) => unknown } }) {
  if (isAppError(err)) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  throw err;
}

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

  app.post('/clients', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          id: z.string().min(2).max(4),
          name: z.string().min(1),
          city: z.string().optional(),
          contact: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional(),
        })
        .parse(request.body);
      return await createClient(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
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

  app.post('/clients/:clientId/sites', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { clientId } = request.params as { clientId: string };
      const body = z
        .object({
          code: z.string().min(1).max(16),
          name: z.string().min(1),
          address: z.string().optional(),
          gstin: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
        })
        .parse(request.body);
      return await createSite(request.user!, clientId, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/users', { preHandler: requireAdmin }, async () => listUsers());

  app.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          email: z.string().email(),
          name: z.string().min(1),
          role: z.nativeEnum(UserRole),
          password: z.string().min(4).optional(),
          clientId: z.string().length(4).nullable().optional(),
          factoryIds: z.array(z.string()).optional(),
          siteIds: z.array(z.string()).optional(),
        })
        .parse(request.body);
      return await createUser(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
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

  app.get('/lookups/:category', { preHandler: requireAuth }, async (request) => {
    const { category } = request.params as { category: string };
    return listLookups(category);
  });

  app.post('/lookups', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          category: z.string().min(1),
          id: z.string().min(1),
          label: z.string().min(1),
          active: z.boolean().optional(),
          rate: z.number().optional(),
          description: z.string().optional(),
        })
        .parse(request.body);
      return await upsertLookup(body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.patch('/clients/:clientId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { clientId } = request.params as { clientId: string };
      const body = z
        .object({
          name: z.string().min(1).optional(),
          city: z.string().optional(),
          contact: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional(),
          payTermsDays: z.number().int().positive().optional(),
          logoFileId: z.string().nullable().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await updateClient(request.user!, clientId, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.patch('/sites/:siteId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { siteId } = request.params as { siteId: string };
      const body = z
        .object({
          name: z.string().optional(),
          address: z.string().optional(),
          gstin: z.string().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await updateSite(request.user!, siteId, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.patch('/users/:userId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const body = z
        .object({
          name: z.string().optional(),
          role: z.nativeEnum(UserRole).optional(),
          clientId: z.string().length(4).nullable().optional(),
          factoryIds: z.array(z.string()).optional(),
          siteIds: z.array(z.string()).optional(),
          active: z.boolean().optional(),
          password: z.string().min(4).optional(),
        })
        .parse(request.body);
      return await updateUser(request.user!, userId, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/factories', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          id: z.string().min(2).max(16),
          name: z.string().min(1),
          address: z.string().optional(),
          gstin: z.string().optional(),
          kspcbConsent: z.string().optional(),
          cpcbEpr: z.string().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await upsertFactory(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.patch('/factories/:factoryId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { factoryId } = request.params as { factoryId: string };
      const body = z
        .object({
          name: z.string().min(1),
          address: z.string().optional(),
          gstin: z.string().optional(),
          kspcbConsent: z.string().optional(),
          cpcbEpr: z.string().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await upsertFactory(request.user!, { id: factoryId, ...body });
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/categories', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          factoryId: z.string().min(1),
          entryId: z.string().min(1),
          description: z.string().min(1),
          groupCode: z.string().min(1),
          capacityTpa: z.number().positive(),
          activity: z.string().optional(),
          authRef: z.string().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await upsertCategory(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });
}
