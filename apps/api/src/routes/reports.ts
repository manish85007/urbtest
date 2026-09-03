import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseReportPeriod } from '@urb-tectrack/shared';
import { attachSession, requireAuth } from '../middleware/session.js';
import { hasFeature } from '../lib/auth-context.js';
import {
  getCapacityReport,
  getHeroesReport,
  getRegisterReport,
  getReportsForActor,
  shareImpactReport,
  REGISTER_KINDS,
  type RegisterType,
} from '../services/reporting-service.js';
import { recordTreePlanting, recordTreeProgress, removeTreePlanting, removeTreeProgress } from '../services/tree-planting.js';
import { form6Pdf, impactPdf, methodologyPdf, mrnPdf, registerPdf } from '../services/pdf.js';
import { documentsZip } from '../services/document-pack.js';
import { contentDisposition } from '../lib/http-headers.js';
import { isAppError } from '../lib/errors.js';

const registerTypes = Object.keys(REGISTER_KINDS) as RegisterType[];

function periodFromQuery(query: Record<string, unknown>) {
  return parseReportPeriod({
    period: typeof query.period === 'string' ? query.period : undefined,
    fy: typeof query.fy === 'string' ? query.fy : undefined,
    year: typeof query.year === 'string' ? query.year : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
  });
}

function handleErr(err: unknown, reply: { badRequest: (m: string) => unknown; status: (n: number) => { send: (b: unknown) => unknown } }) {
  if (isAppError(err)) return reply.status(err.statusCode).send({ message: err.message });
  return reply.badRequest(err instanceof Error ? err.message : 'Request failed');
}

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/reports/dashboard', { preHandler: requireAuth }, async (request) => {
    const q = request.query as { siteId?: string };
    return getReportsForActor(request.user!, q.siteId, periodFromQuery(request.query as Record<string, unknown>));
  });

  app.get('/reports/capacity', { preHandler: requireAuth }, async (request, reply) => {
    const { factoryId } = request.query as { factoryId?: string };
    if (!factoryId) return reply.badRequest('factoryId is required.');
    try {
      return await getCapacityReport(
        request.user!,
        factoryId,
        periodFromQuery(request.query as Record<string, unknown>),
      );
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/reports/heroes', { preHandler: requireAuth }, async (request) => {
    const q = request.query as { clientId?: string };
    return getHeroesReport(request.user!, periodFromQuery(request.query as Record<string, unknown>), {
      clientId: q.clientId,
    });
  });

  app.get('/reports/register/:type', { preHandler: requireAuth }, async (request, reply) => {
    const { type } = request.params as { type: string };
    if (!registerTypes.includes(type as RegisterType)) {
      return reply.badRequest(`Unknown register type: ${type}`);
    }
    const q = request.query as { clientId?: string; siteId?: string };
    try {
      return await getRegisterReport(
        request.user!,
        type as RegisterType,
        periodFromQuery(request.query as Record<string, unknown>),
        { clientId: q.clientId, siteId: q.siteId },
      );
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/reports/register/:type/pdf', { preHandler: requireAuth }, async (request, reply) => {
    const { type } = request.params as { type: string };
    if (!registerTypes.includes(type as RegisterType)) {
      return reply.badRequest(`Unknown register type: ${type}`);
    }
    const q = request.query as { clientId?: string; siteId?: string };
    try {
      const { filename, buffer } = await registerPdf(
        request.user!,
        type as RegisterType,
        periodFromQuery(request.query as Record<string, unknown>),
        { clientId: q.clientId, siteId: q.siteId },
      );
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', contentDisposition('attachment', filename))
        .send(buffer);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/reports/heroes/plantings', { preHandler: requireAuth }, async (request, reply) => {
    const body = z
      .object({
        trees: z.number().int().positive(),
        plantedAt: z.string(),
        location: z.string().optional(),
        state: z.string().optional(),
        partner: z.string().optional(),
        species: z.string().optional(),
        note: z.string().optional(),
        photoFileId: z.string().optional(),
        clientId: z.string().length(4).optional(),
        source: z.enum(['urbeno', 'client']).optional(),
      })
      .parse(request.body);
    try {
      return await recordTreePlanting(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/trees/:id/progress', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        notedAt: z.string(),
        photoFileId: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await recordTreeProgress(request.user!, id, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.delete('/trees/:id/progress/:progressId', { preHandler: requireAuth }, async (request, reply) => {
    const { id, progressId } = request.params as { id: string; progressId: string };
    try {
      return await removeTreeProgress(request.user!, id, progressId);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.delete('/trees/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await removeTreePlanting(request.user!, id);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/invoices/:id/mrn.pdf', { preHandler: requireAuth }, async (request, reply) => {
    if (!hasFeature(request.user!, 'reports.mrn')) return reply.forbidden('You do not have access to MRN PDFs.');
    try {
      const { id } = request.params as { id: string };
      const { filename, buffer } = await mrnPdf(request.user!, id);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', contentDisposition('attachment', filename))
        .send(buffer);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/invoices/:id/form6.pdf', { preHandler: requireAuth }, async (request, reply) => {
    if (!hasFeature(request.user!, 'reports.form6')) return reply.forbidden('You do not have access to Form 6 PDFs.');
    try {
      const { id } = request.params as { id: string };
      const { filename, buffer } = await form6Pdf(request.user!, id);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', contentDisposition('attachment', filename))
        .send(buffer);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/reports/documents.zip', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const q = request.query as Record<string, unknown>;
      const type = q.type === 'form6' ? 'form6' : q.type === 'cod' ? 'cod' : null;
      if (!type) return reply.badRequest('type must be cod or form6.');
      const clientId = typeof q.clientId === 'string' && q.clientId ? q.clientId : undefined;
      const siteId = typeof q.siteId === 'string' && q.siteId ? q.siteId : undefined;
      const { filename, buffer } = await documentsZip(
        request.user!,
        type,
        periodFromQuery(q),
        { clientId, siteId },
      );
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', contentDisposition('attachment', filename))
        .send(buffer);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/reports/impact.pdf', { preHandler: requireAuth }, async (request, reply) => {
    if (!hasFeature(request.user!, 'reports.sustain')) return reply.forbidden('You do not have access to the impact report.');
    try {
      const q = request.query as Record<string, unknown>;
      const clientId = typeof q.clientId === 'string' && q.clientId ? q.clientId : undefined;
      const { filename, buffer } = await impactPdf(
        request.user!,
        periodFromQuery(q),
        clientId,
      );
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', contentDisposition('attachment', filename))
        .send(buffer);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/reports/impact/share', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const body = z
        .object({
          clientId: z.string().min(1),
          period: z.string().optional(),
          fy: z.string().optional(),
          year: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .parse(request.body);
      return await shareImpactReport(request.user!, body.clientId, parseReportPeriod(body));
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/reports/methodology.pdf', { preHandler: requireAuth }, async (request, reply) => {
    const { filename, buffer } = await methodologyPdf(request.user!);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', contentDisposition('attachment', filename))
      .send(buffer);
  });
}
