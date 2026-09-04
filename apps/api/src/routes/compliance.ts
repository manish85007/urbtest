import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { attachSession, requireAdmin, requireAdminOrAuditor, requireAuth } from '../middleware/session.js';
import { isAppError } from '../lib/errors.js';
import { verifyChain } from '../services/audit.js';
import { listSecurityEvents } from '../services/security-log.js';
import {
  closeDSR,
  closeReview,
  consentStats,
  controlStatus,
  decideReview,
  evidencePack,
  listDisposals,
  listDsrs,
  listIncidents,
  listReviews,
  openReview,
  raiseDSR,
  raiseIncident,
  recordDisposal,
  retentionRegister,
  startReview,
  subjectData,
  updateIncident,
  withdrawConsent,
} from '../services/compliance.js';

function fail(reply: { badRequest: (m: string) => unknown; status: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  const message = err instanceof Error ? err.message : 'Request failed';
  if (isAppError(err) && err.statusCode === 403) {
    return reply.status(403).send({ message, error: 'Forbidden', statusCode: 403 });
  }
  return reply.badRequest(message);
}

export async function complianceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/compliance/controls', { preHandler: requireAdminOrAuditor }, async () => ({
    controls: await controlStatus(),
    stats: await consentStats(),
  }));

  app.get('/compliance/security', { preHandler: requireAdminOrAuditor }, async (request) => {
    const q = request.query as Record<string, string | undefined>;
    return listSecurityEvents({
      kind: q.kind,
      severity: q.severity,
      em: q.em,
      from: q.from,
      to: q.to,
      q: q.q,
    });
  });

  app.get('/compliance/reviews', { preHandler: requireAdminOrAuditor }, async () => ({
    open: await openReview(),
    reviews: await listReviews(),
  }));

  app.post('/compliance/reviews', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      return await startReview(request.user!);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/compliance/reviews/:id/decide', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        email: z.string().email(),
        decision: z.enum(['keep', 'revoke']),
        note: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await decideReview(request.user!, id, body.email, body.decision, body.note);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/compliance/reviews/:id/close', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await closeReview(request.user!, id);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/compliance/incidents', { preHandler: requireAdminOrAuditor }, async () => ({
    incidents: await listIncidents(),
  }));

  app.post('/compliance/incidents', { preHandler: requireAdmin }, async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1),
        severity: z.enum(['low', 'medium', 'high']),
        category: z.string().optional(),
        detectedAt: z.string().optional(),
        description: z.string().optional(),
        summary: z.string().optional(),
        affected: z.string().optional(),
        reportable: z.boolean().optional(),
      })
      .parse(request.body);
    try {
      return await raiseIncident(request.user!, body);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.patch('/compliance/incidents/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        title: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high']).optional(),
        status: z.enum(['open', 'contained', 'closed']).optional(),
        description: z.string().optional(),
        summary: z.string().optional(),
        rootCause: z.string().optional(),
        action: z.string().optional(),
        reportable: z.boolean().optional(),
        detectedAt: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await updateIncident(request.user!, id, body);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/compliance/privacy', { preHandler: requireAdminOrAuditor }, async () => {
    const stats = await consentStats();
    const dsrs = await listDsrs();
    return { ...stats, dsrs };
  });

  app.post('/compliance/dsr', { preHandler: requireAdmin }, async (request, reply) => {
    const body = z
      .object({
        kind: z.string().min(1),
        subject: z.string().min(1),
        cid: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await raiseDSR(request.user!, body);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/compliance/dsr/:id/close', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ outcome: z.string() }).parse(request.body);
    try {
      return await closeDSR(request.user!, id, body.outcome);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/compliance/subject', { preHandler: requireAdminOrAuditor }, async (request, reply) => {
    const email = (request.query as { email?: string }).email;
    if (!email) return reply.badRequest('Record who made the request.');
    return subjectData(email);
  });

  app.post('/compliance/consent/withdraw', { preHandler: requireAdmin }, async (request, reply) => {
    const body = z.object({ email: z.string().email(), reason: z.string().min(1) }).parse(request.body);
    try {
      return await withdrawConsent(request.user!, body.email, body.reason);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/compliance/retention', { preHandler: requireAdminOrAuditor }, async () => ({
    register: await retentionRegister(),
    disposals: await listDisposals(),
    years: (await consentStats()).retentionYears,
  }));

  app.post('/compliance/disposals', { preHandler: requireAdmin }, async (request, reply) => {
    const body = z
      .object({
        kind: z.string().min(1),
        describes: z.string().min(1),
        method: z.string().min(1),
        approvedBy: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await recordDisposal(request.user!, body);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/compliance/evidence', { preHandler: requireAdminOrAuditor }, async (request) => {
    return evidencePack(request.user!);
  });

  app.get('/compliance/audit-chain', { preHandler: requireAdminOrAuditor }, async () => verifyChain());

  app.get('/compliance/forbidden-check', { preHandler: requireAuth }, async (request, reply) => {
    if (request.user!.role !== 'admin') {
      return reply.status(403).send({
        message: 'Compliance is administrator-only. These registers hold personal data and security records.',
        error: 'Forbidden',
        statusCode: 403,
      });
    }
    return { ok: true };
  });
}
