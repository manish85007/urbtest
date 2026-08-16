import { auditLog } from './audit.js';

/** Phase 5 will replace with SES/SendGrid. For now, audit the intent to send. */
export async function sendTransactionalEmail(
  templateKey: string,
  to: string[],
  vars: Record<string, unknown>,
) {
  await auditLog({
    actorEmail: 'system',
    action: 'email.queued',
    entity: 'email',
    entityId: templateKey,
    details: { to, vars },
  });
}
