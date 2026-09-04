import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAdmin, requireAuth, requireStaff } from '../middleware/session.js';
import { factoryInScope, isStaff } from '../lib/auth-context.js';
import { isAppError } from '../lib/errors.js';
import { listAllLookups, listLookups, upsertLookup } from '../services/lookups.js';
import {
  createClient,
  createSite,
  createUser,
  getClientDetail,
  listClientPortalUsersForSite,
  listClientsForMasters,
  listFactoriesForMasters,
  listUsers,
  patchCategory,
  updateClient,
  updateSite,
  updateUser,
  upsertCategory,
  upsertFactory,
  adminResetUserPassword,
} from '../services/masters-write.js';
import { lookupGstin } from '../services/gst-lookup.js';

function handleErr(err: unknown, reply: { badRequest: (m: string) => unknown; status: (n: number) => { send: (b: unknown) => unknown } }) {
  if (err instanceof ZodError) {
    return reply.status(400).send({ message: err.issues[0]?.message ?? 'Invalid input.' });
  }
  if (isAppError(err)) {
    return reply.status(err.statusCode).send({ message: err.message });
  }
  throw err;
}

const emptyToUndef = (v: unknown) => (typeof v === 'string' && !v.trim() ? undefined : v);

const siteBody = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1),
  address: z.string().min(1),
  gstin: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  pin: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.preprocess(emptyToUndef, z.string().email().optional()),
});

export async function mastersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/gstin/:gstin', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { gstin } = request.params as { gstin: string };
      return await lookupGstin(gstin);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/clients', { preHandler: requireAuth }, async (request) => {
    const actor = request.user!;
    const includeInactive = isStaff(actor) && (request.query as { includeInactive?: string }).includeInactive === '1';

    if (isStaff(actor)) {
      return listClientsForMasters(includeInactive);
    }
    if (!actor.clientId) return [];
    const list = await listClientsForMasters(false);
    return list.filter((c) => c.id === actor.clientId);
  });

  app.get('/clients/:clientId', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { clientId } = request.params as { clientId: string };
      return await getClientDetail(clientId);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/clients', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          id: z.string().length(4),
          name: z.string().min(1),
          city: z.string().optional(),
          contact: z.string().optional(),
          phone: z.string().optional(),
          email: z.preprocess(emptyToUndef, z.string().email().optional()),
          payTermsDays: z.number().int().min(0).optional(),
          logoFileId: z.string().nullable().optional(),
          showPortalLogo: z.boolean().optional(),
          sites: z.array(siteBody).min(1),
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
    const includeInactive = isStaff(actor) && (request.query as { includeInactive?: string }).includeInactive === '1';

    if (!isStaff(actor) && actor.clientId !== clientId) {
      return reply.forbidden('Access denied.');
    }

    const sites = await prisma.site.findMany({
      where: { clientId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });

    if (!isStaff(actor) && actor.siteIds.length) {
      return sites.filter((s) => actor.siteIds.includes(s.id));
    }
    return sites;
  });

  app.get('/clients/:clientId/portal-users', { preHandler: requireStaff }, async (request, reply) => {
    try {
      const { clientId } = request.params as { clientId: string };
      const { siteId } = request.query as { siteId?: string };
      if (!siteId?.trim()) {
        return reply.badRequest('siteId query parameter is required.');
      }
      return await listClientPortalUsersForSite(clientId, siteId.trim());
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/clients/:clientId/sites', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { clientId } = request.params as { clientId: string };
      const body = siteBody.parse(request.body);
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
          featureAccess: z.record(z.boolean()).nullable().optional(),
        })
        .parse(request.body);
      return await createUser(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/factories', { preHandler: requireAuth }, async (request) => {
    const actor = request.user!;
    const includeInactive = actor.role === 'admin' && (request.query as { includeInactive?: string }).includeInactive === '1';
    const all = await listFactoriesForMasters(includeInactive);
    if (actor.role === 'factory') {
      return all.filter((f) => factoryInScope(actor, f.id));
    }
    return all;
  });

  app.get('/factories/:factoryId/categories', { preHandler: requireAuth }, async (request, reply) => {
    const { factoryId } = request.params as { factoryId: string };
    const actor = request.user!;
    const includeInactive = isStaff(actor) && (request.query as { includeInactive?: string }).includeInactive === '1';

    if (!factoryInScope(actor, factoryId) && actor.role !== 'admin') {
      return reply.forbidden('Access denied.');
    }
    if (actor.role === 'client' || actor.role === 'client_readonly') {
      return reply.forbidden('Access denied.');
    }

    const rows = await prisma.categoryMaster.findMany({
      where: { factoryId, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ groupCode: 'asc' }, { entryId: 'asc' }],
    });
    return rows.map((c) => ({
      id: c.id,
      entryId: c.entryId,
      description: c.description,
      groupCode: c.groupCode,
      capacityTpa: c.capacityTpa.toString(),
      activity: c.activity,
      authRef: c.authRef,
      active: c.active,
    }));
  });

  app.get('/lookups', { preHandler: requireAdmin }, async (request) => {
    const includeInactive = (request.query as { includeInactive?: string }).includeInactive !== '0';
    return listAllLookups(includeInactive);
  });

  app.get('/lookups/:category', { preHandler: requireAuth }, async (request) => {
    const { category } = request.params as { category: string };
    const actor = request.user!;
    const includeInactive = isStaff(actor) && (request.query as { includeInactive?: string }).includeInactive === '1';
    return listLookups(category, includeInactive);
  });

  app.post('/lookups', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          category: z.string().min(1),
          id: z.string().optional(),
          label: z.string().optional(),
          active: z.boolean().optional(),
          rate: z.number().optional(),
          description: z.string().optional(),
          days: z.number().optional(),
          code: z.string().optional(),
          phone: z.string().optional(),
          gstin: z.string().optional(),
          transporterId: z.string().optional(),
          address: z.string().optional(),
          gst: z.number().optional(),
          data: z.record(z.unknown()).optional(),
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
          email: z.preprocess(emptyToUndef, z.string().email().optional()),
          payTermsDays: z.number().int().min(0).optional(),
          logoFileId: z.string().nullable().optional(),
          showPortalLogo: z.boolean().optional(),
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
          city: z.string().optional(),
          state: z.string().optional(),
          pin: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.preprocess(emptyToUndef, z.string().email().optional()),
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
          featureAccess: z.record(z.boolean()).nullable().optional(),
        })
        .parse(request.body);
      return await updateUser(request.user!, userId, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/users/:userId/reset-password', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      return await adminResetUserPassword(request.user!, userId);
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
          managerEmail: z.preprocess(emptyToUndef, z.string().email().optional()),
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
          managerEmail: z.preprocess(emptyToUndef, z.string().email().nullable().optional()),
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

  app.patch('/categories/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isFinite(id)) throw new Error('Invalid category id');
      const body = z
        .object({
          description: z.string().optional(),
          groupCode: z.string().optional(),
          capacityTpa: z.number().positive().optional(),
          activity: z.string().optional(),
          authRef: z.string().optional(),
          active: z.boolean().optional(),
        })
        .parse(request.body);
      return await patchCategory(request.user!, id, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });
}
