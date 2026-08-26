import type { SessionUser } from '../lib/auth-context.js';
import { hasFeature } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { requireAdmin, loadSubmissionForActor } from '../lib/access.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { sendTransactionalEmail } from './email.js';

const PORTAL_URL = process.env.PORTAL_URL ?? 'http://localhost:5173';

export async function sendComplianceDocuments(
  actor: SessionUser,
  submissionId: string,
  input: { certificateIds?: string[]; form6InvoiceIds?: string[] },
) {
  requireAdmin(actor);
  if (!hasFeature(actor, 'compliance.email')) {
    throw new AppError('You do not have permission to send compliance documents by email.', 403);
  }
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
  }

  for (const c of certs) {
    lines.push(
      `  • Certificate ${c.certNo} (${c.invoice.invoiceNo})${c.department ? ` — ${c.department}` : ''}`,
    );
  }
  for (const invId of form6InvoiceIds) {
    const inv = sub.invoices.find((i) => i.id === invId)!;
    lines.push(`  • Form 6 ${inv.recycling!.form6No} (${inv.invoiceNo})`);
  }

  const users = await prisma.user.findMany({
    where: { clientId: sub.clientId, active: true, role: 'client' },
    select: { email: true },
  });
  const recipients = [
    ...new Set([sub.createdBy, ...users.map((u) => u.email)].filter(Boolean)),
  ];
  if (!recipients.length) {
    throw new AppError('This client has no active portal users to email.');
  }

  const creator = await prisma.user.findUnique({
    where: { email: sub.createdBy },
    select: { name: true },
  });

  await sendTransactionalEmail('compliance_docs_share', recipients, {
    contact_name: creator?.name || sub.client.contact || sub.client.name,
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
    },
  });

  return { sent: recipients.length, recipients, documents: lines.length };
}
