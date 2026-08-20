import type { SubmissionFull } from '../lib/db-helpers.js';
import { prisma } from '../lib/prisma.js';
import { sendTransactionalEmail } from './email.js';

export interface ClientContact {
  email: string;
  name: string;
}

/** Client portal user who should receive lifecycle emails (on-behalf requestor when set). */
export async function clientContactFor(
  sub: Pick<SubmissionFull, 'clientId' | 'createdBy' | 'onBehalfOf' | 'client' | 'site'>,
): Promise<ClientContact> {
  const onBehalf = sub.onBehalfOf?.trim().toLowerCase();
  if (onBehalf) {
    const user = await prisma.user.findFirst({
      where: { email: onBehalf, clientId: sub.clientId, active: true },
      select: { email: true, name: true },
    });
    return { email: onBehalf, name: user?.name ?? onBehalf };
  }

  const creator = await prisma.user.findFirst({
    where: { email: sub.createdBy, clientId: sub.clientId, role: 'client', active: true },
    select: { email: true, name: true },
  });
  if (creator) return { email: creator.email, name: creator.name };

  const fallbackEmail =
    sub.site.contactEmail?.trim().toLowerCase() ||
    sub.client.email?.trim().toLowerCase() ||
    sub.createdBy;
  const fallbackUser = await prisma.user.findFirst({
    where: { email: fallbackEmail, active: true },
    select: { name: true },
  });
  return { email: fallbackEmail, name: fallbackUser?.name ?? fallbackEmail.split('@')[0] ?? 'Client' };
}

export async function notifyClient(
  sub: SubmissionFull,
  templateKey: string,
  vars: Record<string, unknown> = {},
) {
  const contact = await clientContactFor(sub);
  await sendTransactionalEmail(templateKey, [contact.email], {
    request_id: sub.id,
    client_name: sub.client.name,
    site_name: sub.site.name,
    contact_name: contact.name,
    ...vars,
  });
  return contact;
}

export async function notifyStaffNewRequest(vars: Record<string, unknown>) {
  await sendTransactionalEmail('request_new_admin', [], vars);
}
