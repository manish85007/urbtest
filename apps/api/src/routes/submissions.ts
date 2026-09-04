import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { attachSession, requireAuth, requireStaff } from '../middleware/session.js';
import { clientScopeFilter } from '../lib/auth-context.js';
import { redactSubmissionForActor } from '../lib/access.js';
import { submissionInclude } from '../lib/db-helpers.js';
import { deriveInvoiceStage, deriveSubmissionStage, withDerivedStages } from '../lib/stage-mapper.js';
import { idParamsSchema, listCursorQuerySchema } from '../lib/params.js';

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [iso, id] = raw.split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function submissionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/submissions', { preHandler: requireAuth }, async (request, reply) => {
    const q = listCursorQuerySchema.safeParse(request.query);
    if (!q.success) return reply.badRequest(q.error.issues[0]?.message ?? 'Invalid query');
    const limit = q.data.limit ?? 100;
    const scope = clientScopeFilter(request.user!);

    const cursorDecoded = q.data.cursor ? decodeCursor(q.data.cursor) : null;
    if (q.data.cursor && !cursorDecoded) {
      return reply.badRequest('Invalid cursor');
    }

    const rows = await prisma.submission.findMany({
      where: {
        ...scope,
        ...(cursorDecoded
          ? {
              OR: [
                { createdAt: { lt: cursorDecoded.createdAt } },
                { createdAt: cursorDecoded.createdAt, id: { lt: cursorDecoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: submissionInclude,
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const next =
      rows.length > limit
        ? encodeCursor(page[page.length - 1]!.createdAt, page[page.length - 1]!.id)
        : null;

    const items = page.map((sub) => {
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
        returned: stage === 1 && !!sub.rejectNote,
        invoiceCount: sub.invoices.length,
        invoices: sub.invoices.map((inv) => ({
          invoiceNo: inv.invoiceNo,
          stage: deriveInvoiceStage(inv),
        })),
        netKg,
        createdAt: sub.createdAt,
      };
    });

    return { items, nextCursor: next };
  });

  app.get('/submissions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return reply.badRequest('Invalid request id');
    const { id } = parsed.data;
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
