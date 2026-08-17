import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAuth, requireStaff } from '../middleware/session.js';
import { clientScopeFilter } from '../lib/auth-context.js';
import { redactSubmissionForActor } from '../lib/access.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { deriveInvoiceStage, deriveSubmissionStage, withDerivedStages } from '../lib/stage-mapper.js';

export async function submissionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/submissions', { preHandler: requireAuth }, async (request) => {
    const scope = clientScopeFilter(request.user!);
    const rows = await prisma.submission.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      include: submissionInclude,
      take: 2000,
    });

    return rows.map((sub) => {
      const stage = deriveSubmissionStage(sub);
      const netKg = sub.vehicles.reduce((sum, v) => sum + Number(v.weighment?.netKg ?? 0), 0);
      return {
        id: sub.id,
        clientId: sub.clientId,
        clientName: sub.client.name,
        siteId: sub.siteId,
        siteName: sub.site.name,
        requestDate: sub.requestDate,
        approxWeight: sub.approxWeight,
        location: sub.location,
        ref: sub.ref,
        stage,
        invoiceCount: sub.invoices.length,
        invoices: sub.invoices.map((inv) => ({
          invoiceNo: inv.invoiceNo,
          stage: deriveInvoiceStage(inv),
        })),
        netKg,
        createdAt: sub.createdAt,
      };
    });
  });

  app.get('/submissions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scope = clientScopeFilter(request.user!);

    const sub = await prisma.submission.findFirst({
      where: { id, ...scope },
      include: submissionInclude,
    });

    if (!sub) return reply.notFound('Request not found');

    return redactSubmissionForActor(withDerivedStages(sub), request.user!);
  });

  app.get('/health/dashboard', { preHandler: requireStaff }, async () => {
    const [openCount, invoiceCount, clientCount] = await Promise.all([
      prisma.submission.count({ where: { closedAt: null } }),
      prisma.invoice.count({ where: { closedAt: null } }),
      prisma.client.count({ where: { active: true } }),
    ]);

    return {
      openRequests: openCount,
      openInvoices: invoiceCount,
      activeClients: clientCount,
    };
  });
}
