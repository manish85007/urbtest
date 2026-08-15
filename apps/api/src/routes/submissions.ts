import type { FastifyInstance } from 'fastify';
import { subStage } from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAuth, requireStaff } from '../middleware/session.js';
import { clientScopeFilter } from '../lib/auth-context.js';

function mapSubmissionStage(sub: {
  acknowledgedAt: Date | null;
  vehicles: { weighment: unknown | null }[];
  invoices: {
    closedAt: Date | null;
    certificates: unknown[];
    recycling: unknown | null;
    mrn: unknown | null;
  }[];
}) {
  const stage = subStage({
    acknowledged: !!sub.acknowledgedAt,
    hasVehicles: sub.vehicles.length > 0,
    allVehiclesWeighed: sub.vehicles.length > 0 && sub.vehicles.every((v) => !!v.weighment),
    invoices: sub.invoices.map((inv) => ({
      closedAt: inv.closedAt,
      hasCertificate: inv.certificates.length > 0,
      hasRecycling: !!inv.recycling,
      hasMrn: !!inv.mrn,
    })),
  });

  return { stage };
}

export async function submissionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/submissions', { preHandler: requireAuth }, async (request) => {
    const scope = clientScopeFilter(request.user!);
    const rows = await prisma.submission.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        site: { select: { id: true, code: true, name: true } },
        vehicles: { include: { weighment: true } },
        invoices: {
          include: {
            mrn: true,
            recycling: true,
            certificates: true,
            payments: true,
          },
        },
      },
      take: 100,
    });

    return rows.map((sub) => {
      const { stage } = mapSubmissionStage(sub);
      return {
        id: sub.id,
        clientId: sub.clientId,
        clientName: sub.client.name,
        siteId: sub.siteId,
        siteName: sub.site.name,
        requestDate: sub.requestDate,
        approxWeight: sub.approxWeight,
        stage,
        invoiceCount: sub.invoices.length,
        createdAt: sub.createdAt,
      };
    });
  });

  app.get('/submissions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scope = clientScopeFilter(request.user!);

    const sub = await prisma.submission.findFirst({
      where: { id, ...scope },
      include: {
        client: true,
        site: true,
        vehicles: { include: { team: true, weighment: true } },
        invoices: {
          include: {
            payments: true,
            mrn: true,
            recycling: { include: { categories: true } },
            certificates: true,
          },
        },
      },
    });

    if (!sub) return reply.notFound('Request not found');

    const { stage } = mapSubmissionStage(sub);
    return { ...sub, derivedStage: stage };
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
