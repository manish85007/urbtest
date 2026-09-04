import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { applyPassword } from './auth.js';
import { recordSecurityEvent } from './security-log.js';
import { processEmailQueue, sendTransactionalEmail } from './email.js';

const RESET_MINS = Number(process.env.RESET_CODE_MINS ?? 15);

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function allowDemoCode(): boolean {
  // Never expose reset OTPs on UAT/production-like hosts — only local dev or explicit e2e.
  return process.env.NODE_ENV === 'development' || process.env.E2E_TEST === 'true';
}

export async function requestPasswordReset(emailRaw: string): Promise<{ sent: true; demoCode?: string | null }> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.active) {
    const code = sixDigitCode();
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.passwordReset.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordReset.create({
      data: {
        email,
        codeHash,
        expiresAt: new Date(Date.now() + RESET_MINS * 60 * 1000),
      },
    });
    await sendTransactionalEmail('password_reset', [email], {
      user_name: user.name,
      code,
      expiry_minutes: RESET_MINS,
      support_email: process.env.URBENO_EMAIL ?? 'info@urbeno.in',
    });
    await processEmailQueue(5).catch(() => undefined);
    await auditLog({ actorEmail: email, action: 'auth.reset.request', entity: 'user', entityId: email });
    await recordSecurityEvent('auth.reset.requested', email, {});
    return { sent: true, ...(allowDemoCode() ? { demoCode: code } : {}) };
  }

  await auditLog({
    actorEmail: email,
    action: 'auth.reset.request',
    entity: 'user',
    entityId: email,
    details: { unknown: true },
  });
  return { sent: true, ...(allowDemoCode() ? { demoCode: null } : {}) };
}

export async function confirmPasswordReset(emailRaw: string, code: string, newPassword: string) {
  const email = emailRaw.trim().toLowerCase();

  const row = await prisma.passwordReset.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new Error('No active reset request for this email. Request a new code.');
  if (row.expiresAt < new Date()) {
    await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    throw new Error(
      `That code expired. Codes are valid for ${RESET_MINS} minutes — request a new one.`,
    );
  }

  const ok = await bcrypt.compare(String(code).trim(), row.codeHash);
  if (!ok) throw new Error('That code is not correct. Check the email and try again.');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active) throw new Error('No active reset request for this email. Request a new code.');

  await applyPassword(user.id, user.email, newPassword);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    // Reset must unlock the account — otherwise users who reset while locked
    // still cannot sign in and conclude "password reset does not work".
    prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    }),
  ]);

  await auditLog({
    actorEmail: email,
    actorId: user.id,
    action: 'auth.reset.confirm',
    entity: 'user',
    entityId: email,
  });
  await recordSecurityEvent('auth.password.reset', email, {});

  return { ok: true };
}
