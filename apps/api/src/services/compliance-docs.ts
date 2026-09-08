import type { SessionUser } from '../lib/auth-context.js';
import { hasFeature } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { requireAdmin, loadSubmissionForActor } from '../lib/access.js';
import { prisma } from '../lib/prisma.js';
import type { SubmissionFull } from '../lib/db-helpers.js';
import { auditLog } from './audit.js';
import { sendTransactionalEmail } from './email.js';
import {
  buildComplianceRecipients,
  selectComplianceRecipients,
  type ComplianceRecipient,
  type RecipientContext,
} from './compliance-recipients.js';

const PORTAL_URL = process.env.PORTAL_URL ?? 'http://localhost:5173';

function requireComplianceEmailAccess(actor: SessionUser) {
  requireAdmin(actor);
  if (!hasFeature(actor, 'compliance.email')) {
    throw new AppError('You do not have permission to send compliance documents by email.', 403);
  }
}

async function recipientContextFor(sub: SubmissionFull): Promise<RecipientContext> {
  const requestActors = [sub.createdBy, sub.onBehalfOf].filter((e): e is string => !!e);
  const [portalUsers, actorUsers] = await Promise.all([
    prisma.user.findMany({
      where: { clientId: sub.clientId, active: true, role: { in: ['client', 'client_readonly'] } },
      select: { email: true, name: true, role: true, siteIds: true, active: true },
    }),
    requestActors.length
      ? prisma.user.findMany({
          where: { email: { in: requestActors } },
          select: { email: true, name: true, role: true, siteIds: true, active: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    users: [...portalUsers, ...actorUsers],
    siteId: sub.siteId,
    siteName: sub.site.name,
    siteContactEmail: sub.site.contactEmail,
    siteContactName: sub.site.contactName,
    createdBy: sub.createdBy,
    onBehalfOf: sub.onBehalfOf,
  };
}

async function complianceRecipientsFor(sub: SubmissionFull): Promise<ComplianceRecipient[]> {
  return buildComplianceRecipients(await recipientContextFor(sub));
}

/** Addresses the admin may pick from before emailing the compliance documents. */
export async function listComplianceRecipients(actor: SessionUser, submissionId: string) {
  requireComplianceEmailAccess(actor);
  const sub = await loadSubmissionForActor(submissionId, actor);
  return {
    submissionId: sub.id,
    clientId: sub.clientId,
    clientName: sub.client.name,
    siteId: sub.siteId,
    siteName: sub.site.name,
    recipients: await complianceRecipientsFor(sub),
  };
}

export async function sendComplianceDocuments(
  actor: SessionUser,
  submissionId: string,
  input: { certificateIds?: string[]; form6InvoiceIds?: string[]; recipientEmails?: string[] },
) {
  requireComplianceEmailAccess(actor);
  const sub = await loadSubmissionForActor(submissionId, actor);
  const certificateIds = [...new Set(input.certificateIds ?? [])];
  const form6InvoiceIds = [...new Set(input.form6InvoiceIds ?? [])];
  if (!certificateIds.length && !form6InvoiceIds.length) {
    throw new AppError('Select at least one document to email.');
  }

  const lines: string[] = [];
  const certs = certificateIds.length
    ? await prisma.certificate.findMany({
        where: { id: { in: certificateIds }, invoice: { submissionId: sub.id } },
        include: { invoice: true },
      })
    : [];
  if (certs.length !== certificateIds.length) {
    throw new AppError('One or more certificates could not be found on this request.');
  }

  for (const invId of form6InvoiceIds) {
    const inv = sub.invoices.find((i) => i.id === invId);
    if (!inv?.recycling) {
      throw new AppError('One or more Form 6 documents could not be found on this request.');
    }
    if (inv.recycling.reviewStatus !== 'approved') {
      throw new AppError(`Form 6 ${inv.recycling.form6No} must be approved before it can be emailed.`);
    }
    if (!inv.recycling.clientPublishedAt) {
      throw new AppError(
        `Form 6 ${inv.recycling.form6No} must be certified for the client portal before it can be emailed.`,
      );
    }
  }

  for (const c of certs) {
    const inv = sub.invoices.find((i) => i.id === c.invoiceId);
    if (!inv?.recycling?.clientPublishedAt) {
      throw new AppError(
        `Certificate ${c.certNo} must be certified for the client portal before it can be emailed.`,
      );
    }
    lines.push(
      `  • Certificate ${c.certNo} (${c.invoice.invoiceNo})${c.department ? ` — ${c.department}` : ''}`,
    );
  }
  for (const invId of form6InvoiceIds) {
    const inv = sub.invoices.find((i) => i.id === invId)!;
    lines.push(`  • Form 6 ${inv.recycling!.form6No} (${inv.invoiceNo})`);
  }

  const candidates = await complianceRecipientsFor(sub);
  const picked = selectComplianceRecipients(candidates, input.recipientEmails ?? null);
  if (picked.unknown.length) {
    throw new AppError(
      `Not a recipient on this request: ${picked.unknown.join(', ')}. Refresh and choose again.`,
    );
  }
  if (!picked.emails.length) {
    throw new AppError(
      picked.mode === 'selected'
        ? 'Select at least one recipient for this email.'
        : `No active portal user is linked to ${sub.site.name}. Choose the recipients before sending.`,
    );
  }
  const recipients = picked.emails;
  const single = recipients.length === 1 ? candidates.find((c) => c.email === recipients[0]) : null;

  await sendTransactionalEmail('compliance_docs_share', recipients, {
    contact_name: single?.name || sub.client.contact || sub.client.name,
    client_name: sub.client.name,
    request_id: sub.id,
    document_list: lines.join('\n'),
    portal_url: `${PORTAL_URL}/requests/${sub.id}`,
  });

  if (certs.length) {
    await prisma.certificate.updateMany({
      where: { id: { in: certs.map((c) => c.id) } },
      data: { mailedAt: new Date() },
    });
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'compliance.email',
    entity: 'submission',
    entityId: sub.id,
    details: {
      certificateIds: certs.map((c) => c.id),
      form6InvoiceIds,
      recipients,
      recipientMode: picked.mode,
      notSent: picked.skipped,
    },
  });

  return {
    sent: recipients.length,
    recipients,
    notSent: picked.skipped,
    documents: lines.length,
  };
}
