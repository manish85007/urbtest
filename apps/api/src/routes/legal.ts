import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { attachSession, requireAuth, requireAdmin } from '../middleware/session.js';
import {
  acceptLegalDocuments,
  getLegalDocument,
  getLegalStatus,
  listLegalDocuments,
} from '../services/legal.js';
import { listAudit } from '../services/audit.js';
import { HSTS_HEADER, SECURITY_HEADERS, isSecureDeployment } from '../lib/http-headers.js';

export async function legalRoutes(app: FastifyInstance) {
  // Use /legal-documents so paths do not collide with the SPA at /legal/:key.
  app.get('/legal-documents', async () => listLegalDocuments());

  app.get('/legal-documents/:key', async (request, reply) => {
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

  // `/audit-log` — not `/audit`, which is the SPA route (same-origin prod build uses no /api prefix).
  app.get('/audit-log', { preHandler: requireAdmin }, async (request) => {
    const q = request.query as {
      limit?: string;
      page?: string;
      entity?: string;
      q?: string;
      actor?: string;
      action?: string;
      from?: string;
      to?: string;
      sort?: string;
    };
    const sort = q.sort;
    return listAudit({
      q: q.q,
      actor: q.actor,
      action: q.action,
      entity: q.entity,
      from: q.from,
      to: q.to,
      sort:
        sort === 'oldest' || sort === 'actor' || sort === 'action' || sort === 'newest'
          ? sort
          : 'newest',
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 100,
    });
  });
}

export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(name, value);
    }
    // HSTS only on HTTPS deployments (UAT/production with COOKIE_SECURE).
    if (isSecureDeployment()) {
      reply.header('Strict-Transport-Security', HSTS_HEADER);
    }
  });
}
