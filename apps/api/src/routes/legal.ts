import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { attachSession, requireAuth, requireAdmin } from '../middleware/session.js';
import {
  acceptLegalDocuments,
  getLegalDocument,
  getLegalStatus,
  listLegalDocuments,
} from '../services/legal.js';
import { prisma } from '../lib/prisma.js';

export async function legalRoutes(app: FastifyInstance) {
  app.get('/legal', async () => listLegalDocuments());

  app.get('/legal/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const doc = await getLegalDocument(key);
    if (!doc) return reply.notFound('Legal document not found.');
    return doc;
  });

  app.addHook('preHandler', attachSession);

  app.get('/auth/legal-status', { preHandler: requireAuth }, async (request) => {
    return getLegalStatus(request.user!.id);
  });

  app.post('/auth/accept-legal', { preHandler: requireAuth }, async (request, reply) => {
    const body = z.object({ keys: z.array(z.string().min(1)).min(1) }).parse(request.body);
    try {
      return await acceptLegalDocuments(
        request.user!.id,
        request.user!.email,
        body.keys,
        request.ip,
      );
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Acceptance failed');
    }
  });
}

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/audit', { preHandler: requireAdmin }, async (request) => {
    const { limit, entity, q } = request.query as {
      limit?: string;
      entity?: string;
      q?: string;
    };
    const take = Math.min(Number(limit ?? 50), 200);

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(q
          ? {
              OR: [
                { action: { contains: q, mode: 'insensitive' } },
                { actorEmail: { contains: q, mode: 'insensitive' } },
                { entityId: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { ts: 'desc' },
      take,
      select: {
        id: true,
        ts: true,
        actorEmail: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
      },
    });

    return rows;
  });
}

export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });
}
