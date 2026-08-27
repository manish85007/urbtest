import type { Prisma } from '@prisma/client';
import { mergeTemplate } from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { deliverEmail } from './email-provider.js';

const PORTAL_URL = process.env.PORTAL_URL ?? 'http://localhost:5173';
const CONTACT_EMAIL = process.env.URBENO_EMAIL ?? 'info@urbeno.in';

const STAFF_ALERT_TEMPLATES = new Set(['request_new_admin']);
const FALLBACK_TEMPLATES: Record<string, { name: string; subject: string; body: string }> = {
  request_new_client: {
    name: 'New Request Confirmation',
    subject: 'Your e-waste pickup request {{request_id}} has been submitted',
    body:
      'Dear {{contact_name}},\n\n' +
      'Your e-waste collection request has been submitted to Urbeno.\n\n' +
      '  Request ID     : {{request_id}}\n' +
      '  Site           : {{site_name}}\n' +
      '  Pickup address : {{location}}\n' +
      '  Request date   : {{request_date}}\n' +
      '  Approx. weight : {{approx_weight}} kg\n' +
      '  Approx. units  : {{approx_qty}}\n\n' +
      'Our operations team will review and acknowledge your request shortly. Track progress in your portal:\n' +
      '{{portal_url}}\n\n' +
      'Warm regards,\n' +
      'Urbeno Private Limited\n' +
      'Recycling Heroes™',
  },
  loading_complete: {
    name: 'Loading Complete',
    subject: 'Loading complete for request {{request_id}} — weighment slips ready',
    body:
      'Dear {{contact_name}},\n\n' +
      'Loading has been completed and weighment documentation is ready for your request {{request_id}} at {{site_name}}.\n\n' +
      '  Total net weight : {{net_weight}} kg\n' +
      '  Vehicles         : {{vehicle_count}}\n\n' +
      'Invoicing will proceed next. Track your request:\n{{portal_url}}\n\n' +
      'Warm regards,\nUrbeno Private Limited',
  },
  invoice_generated: {
    name: 'Invoice & E-way Generated',
    subject: 'Invoice {{invoice_no}} raised for request {{request_id}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'An invoice and e-way bill have been generated for your request {{request_id}}.\n\n' +
      '  Invoice   : {{invoice_no}}\n' +
      '  E-way bill: {{eway_bill_no}}\n' +
      '  Billed    : {{billing_weight}} kg\n' +
      '  Amount    : {{invoice_total}}\n\n' +
      '{{portal_url}}\n\nWarm regards,\nUrbeno Private Limited',
  },
  mrn_generated: {
    name: 'MRN Generated',
    subject: 'Goods received — MRN {{mrn_no}} for invoice {{invoice_no}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'Material for request {{request_id}} has been received at our facility.\n\n' +
      '  MRN     : {{mrn_no}}\n' +
      '  Invoice : {{invoice_no}}\n' +
      '  Facility: {{factory_name}}\n\n' +
      '{{portal_url}}\n\nWarm regards,\nUrbeno Private Limited',
  },
  recycling_form6: {
    name: 'Recycling & Form 6',
    subject: 'Form 6 {{form6_no}} issued for invoice {{invoice_no}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'Recycling has been completed and Form 6 has been issued for request {{request_id}}.\n\n' +
      '  Form 6  : {{form6_no}}\n' +
      '  Invoice : {{invoice_no}}\n\n' +
      '{{portal_url}}\n\nWarm regards,\nUrbeno Private Limited',
  },
  cod_generated: {
    name: 'Certificate of Destruction',
    subject: 'Certificate {{cert_no}} issued for request {{request_id}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'The Certificate of Destruction has been uploaded for request {{request_id}}.\n\n' +
      '  Certificate : {{cert_no}}\n' +
      '  Invoice     : {{invoice_no}}\n' +
      '  Date        : {{cert_date}}\n\n' +
      'Please review and acknowledge closure in your portal when ready:\n{{portal_url}}\n\n' +
      'Warm regards,\nUrbeno Private Limited',
  },
  request_closed: {
    name: 'Request Closed',
    subject: 'Request {{request_id}} closed successfully',
    body:
      'Dear {{contact_name}},\n\n' +
      'Your e-waste collection request {{request_id}} for {{site_name}} has been closed.\n\n' +
      'Thank you for partnering with Urbeno. Your recycled tonnage counts toward your Recycling Heroes milestones.\n\n' +
      '{{portal_url}}\n\nWarm regards,\nUrbeno Private Limited',
  },
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
  impact_share: {
    name: 'Sustainability impact share',
    subject: 'Sustainability impact report — {{client_name}} · {{period_label}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'Urbeno has prepared your organisation’s sustainability impact summary for {{period_label}}.\n\n' +
      '  Weight recycled : {{kg}} kg\n' +
      '  CO₂e avoided    : {{co2}} kg\n' +
      '  Landfill diverted: {{landfill}} kg\n' +
      '  Water saved     : {{water}} kL\n' +
      '  Energy saved    : {{energy}} kWh\n' +
      '  Closed invoices : {{invoices}}\n\n' +
      'Review the full report and download the impact PDF from your Urb TecTrack portal:\n' +
      '{{portal_url}}\n\n' +
      'Warm regards,\n' +
      'Urbeno Private Limited\n' +
      'Recycling Heroes™',
  },
  compliance_docs_share: {
    name: 'Compliance documents share',
    subject: 'Compliance documents for request {{request_id}}',
    body:
      'Dear {{contact_name}},\n\n' +
      'The following compliance documents for {{client_name}} are ready to review:\n\n' +
      '{{document_list}}\n\n' +
      'Sign in to your Urb TecTrack portal to download them:\n' +
      '{{portal_url}}\n\n' +
      'Warm regards,\n' +
      'Urbeno Private Limited\n' +
      'Recycling Heroes™',
  },
};

async function resolveRecipients(templateKey: string, to: string[]): Promise<string[]> {
  const filtered = to.filter(Boolean);
  if (filtered.length) return filtered;

  if (STAFF_ALERT_TEMPLATES.has(templateKey)) {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['admin', 'operations'] }, active: true },
      select: { email: true },
    });
    return staff.map((s) => s.email);
  }

  return [];
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

  const mergedVars = {
    portal_url: PORTAL_URL,
    contact_email: CONTACT_EMAIL,
    support_email: CONTACT_EMAIL,
    ...vars,
  };
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
