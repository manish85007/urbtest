import type { Prisma } from '@prisma/client';
import { mergeTemplate } from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { deliverEmail } from './email-provider.js';

const PORTAL_URL = process.env.PORTAL_URL ?? 'http://localhost:5173';

const ADMIN_TEMPLATES = new Set(['request_new_admin']);
const FALLBACK_TEMPLATES: Record<string, { name: string; subject: string; body: string }> = {
  request_stage_update: {
    name: 'Request Stage Update',
    subject: 'Update on your request {{request_id}} — now at {{stage_name}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'Your Urb TecTrack request has moved to the next stage.\n\n' +
      '  Request ID : {{request_id}}\n' +
      '  Site       : {{site_name}}\n' +
      '  New stage  : {{stage_name}}\n' +
      '  Update     : {{status_detail}}\n\n' +
      'You can review the latest status in your Urb TecTrack portal:\n' +
      '{{portal_url}}\n\n' +
      'Warm regards,\n' +
      'Urbeno Private Limited\n' +
      'Recycling Heroes™',
  },
};

async function resolveRecipients(templateKey: string, to: string[]): Promise<string[]> {
  const filtered = to.filter(Boolean);
  if (filtered.length || !ADMIN_TEMPLATES.has(templateKey)) return filtered;

  const admins = await prisma.user.findMany({
    where: { role: 'admin', active: true },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

/** Queue a transactional email — async delivery via processEmailQueue(). */
export async function sendTransactionalEmail(
  templateKey: string,
  to: string[],
  vars: Record<string, unknown>,
) {
  const dbTemplate = await prisma.emailTemplate.findUnique({ where: { key: templateKey } });
  const fallback = FALLBACK_TEMPLATES[templateKey];
  const template = dbTemplate
    ? { name: dbTemplate.name, subject: dbTemplate.subject, body: dbTemplate.body }
    : fallback;
  if (!template) {
    await auditLog({
      actorEmail: 'system',
      action: 'email.missing_template',
      entity: 'email',
      entityId: templateKey,
      details: { to, vars },
    });
    return null;
  }

  const recipients = await resolveRecipients(templateKey, to);
  if (!recipients.length) return null;

  const mergedVars = { portal_url: PORTAL_URL, ...vars };
  const subject = mergeTemplate(template.subject, mergedVars);
  const body = mergeTemplate(template.body, mergedVars);

  const record = await prisma.emailOutbox.create({
    data: {
      templateKey,
      templateName: template.name,
      to: recipients,
      subject,
      body,
      vars: mergedVars as Prisma.InputJsonValue,
      status: 'queued',
    },
  });

  await auditLog({
    actorEmail: 'system',
    action: 'email.queued',
    entity: 'email',
    entityId: record.id,
    details: { templateKey, to: recipients, subject },
  });

  return record;
}

export async function processEmailQueue(limit = 20) {
  const pending = await prisma.emailOutbox.findMany({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      await deliverEmail({
        to: email.to,
        subject: email.subject,
        body: email.body,
      });
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 } },
      });
      await auditLog({
        actorEmail: 'system',
        action: 'email.sent',
        entity: 'email',
        entityId: email.id,
        details: { templateKey: email.templateKey, to: email.to, subject: email.subject },
      });
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: 'failed', error: message, attempts: { increment: 1 } },
      });
      failed++;
    }
  }

  return { sent, failed, processed: pending.length };
}

export async function listEmailOutbox(limit = 50) {
  return prisma.emailOutbox.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      templateKey: true,
      templateName: true,
      to: true,
      subject: true,
      status: true,
      sentAt: true,
      createdAt: true,
      error: true,
      body: true,
    },
  });
}
