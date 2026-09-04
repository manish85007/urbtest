import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { attachSession, requireAuth, requireAdminOrAuditor } from '../middleware/session.js';
import {
  acceptLegalDocuments,
  getLegalDocument,
  getLegalStatus,
  listLegalDocuments,
} from '../services/legal.js';
import { listAudit } from '../services/audit.js';
import { HSTS_HEADER, SECURITY_HEADERS, isSecureDeployment } from '../lib/http-headers.js';
import { bumpRateLimit } from '../lib/rate-limit-store.js';
import { isAppError } from '../lib/errors.js';

export async function legalRoutes(app: FastifyInstance) {
  // Public legal catalogue — rate-limited to deter scraping.
  app.get('/legal-documents', async (request, reply) => {
    try {
      await bumpRateLimit(
        `legal:list:${request.ip}`,
        60_000,
        60,
        'Too many requests for legal documents. Try again shortly.',
      );
      return listLegalDocuments();
    } catch (err) {
      if (isAppError(err) && err.statusCode === 429) {
        return reply.status(429).send({ message: err.message, error: 'Too Many Requests', statusCode: 429 });
      }
      throw err;
    }
  });

  app.get('/legal-documents/:key', async (request, reply) => {
    try {
      await bumpRateLimit(
        `legal:doc:${request.ip}`,
        60_000,
        30,
        'Too many requests for legal documents. Try again shortly.',
      );
      const { key } = request.params as { key: string };
      const doc = await getLegalDocument(key);
      if (!doc) return reply.notFound('Legal document not found.');
      return doc;
    } catch (err) {
      if (isAppError(err) && err.statusCode === 429) {
        return reply.status(429).send({ message: err.message, error: 'Too Many Requests', statusCode: 429 });
      }
      throw err;
    }
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
  app.get('/audit-log', { preHandler: requireAdminOrAuditor }, async (request) => {
    const q = request.query as {
      limit?: string;
      page?: string;
      cursor?: string;
      entity?: string;
      q?: string;
      actor?: string;
      action?: string;
      from?: string;
      to?: string;
      sort?: string;
    };
    const sort = q.sort;
    const limit = q.limit ? Math.min(Number(q.limit), 200) : 100;
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
      limit,
    });
  });
}

export function registerSecurityHeaders(app: FastifyInstance) {
  // App-level headers (always set). Proxy / Cloud Run may also set HSTS + CSP;
  // duplicates are fine — we set a full set here so a misconfigured proxy still
  // gets baseline protection from the API process.
  app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(name, value);
    }
    // HSTS only on HTTPS deployments (UAT/production with COOKIE_SECURE).
    if (isSecureDeployment()) {
      reply.header('Strict-Transport-Security', HSTS_HEADER);
    }
    // Hide Node/Fastify identity; Cloud Run's GFE may still inject "Google Frontend".
    reply.removeHeader('Server');
  });
}
