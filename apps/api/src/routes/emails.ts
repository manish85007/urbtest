import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { attachSession, requireAdmin, requireAuth } from '../middleware/session.js';
import { listEmailOutbox } from '../services/email.js';
import {
  createEmailTemplate,
  listEmailTemplates,
  sendCampaign,
  updateEmailTemplate,
} from '../services/masters-write.js';
import { getCompanyProfile, getSmtpSettings, saveCompanyProfile, saveSmtpSettings, sendTestEmail, smtpPublicView } from '../services/settings.js';
import { isAppError } from '../lib/errors.js';

function handleErr(err: unknown, reply: { badRequest: (m: string) => unknown; status: (n: number) => { send: (b: unknown) => unknown } }) {
  if (err instanceof ZodError) {
    return reply.status(400).send({ message: err.issues[0]?.message ?? 'Invalid input.' });
  }
  if (isAppError(err)) return reply.status(err.statusCode).send({ message: err.message });
  throw err;
}

export async function emailsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/emails/outbox', { preHandler: requireAdmin }, async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 50);
    return listEmailOutbox(Math.min(limit, 200));
  });

  app.get('/email-templates', { preHandler: requireAdmin }, async () => listEmailTemplates());

  app.post('/email-templates', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          key: z.string().min(2),
          name: z.string().min(1),
          subject: z.string().min(1),
          body: z.string().min(1),
        })
        .parse(request.body);
      return await createEmailTemplate(request.user!, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.put('/email-templates/:key', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { key } = request.params as { key: string };
      const body = z
        .object({
          name: z.string().optional(),
          subject: z.string().optional(),
          body: z.string().optional(),
        })
        .parse(request.body);
      return await updateEmailTemplate(request.user!, key, body);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/email-templates/:key/campaign', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { key } = request.params as { key: string };
      const body = z.object({ to: z.array(z.string().email()).min(1) }).parse(request.body);
      return await sendCampaign(request.user!, key, body.to);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/settings/email', { preHandler: requireAdmin }, async () => smtpPublicView(await getSmtpSettings()));

  app.put('/settings/email', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          enabled: z.boolean().optional(),
          host: z.string().optional(),
          port: z.number().int().positive().optional(),
          secure: z.boolean().optional(),
          user: z.string().optional(),
          pass: z.string().optional(),
          fromName: z.string().optional(),
          fromEmail: z.string().optional(),
        })
        .parse(request.body);
      return await saveSmtpSettings(body, request.user!.email);
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.post('/settings/email/test', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z.object({ to: z.string().email() }).parse(request.body);
      await sendTestEmail(body.to);
      return { ok: true };
    } catch (err) {
      return handleErr(err, reply);
    }
  });

  app.get('/settings/company', { preHandler: requireAuth }, async () => getCompanyProfile());

  app.put('/settings/company', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const body = z
        .object({
          name: z.string().optional(),
          brand: z.string().optional(),
          address: z.string().optional(),
          gst: z.string().optional(),
          pan: z.string().optional(),
          cin: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          wa: z.string().optional(),
          cpcb: z.string().optional(),
          kspcb: z.string().optional(),
          r2: z.string().optional(),
          logoFileId: z.string().nullable().optional(),
        })
        .parse(request.body);
      return await saveCompanyProfile(body, request.user!.email);
    } catch (err) {
      return handleErr(err, reply);
    }
  });
}
