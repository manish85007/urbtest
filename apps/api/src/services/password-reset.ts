import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { hashPassword } from './auth.js';
import { processEmailQueue, sendTransactionalEmail } from './email.js';

const RESET_MINS = Number(process.env.RESET_CODE_MINS ?? 15);

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function allowDemoCode(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.E2E_TEST === 'true';
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
      support_email: process.env.URBENO_EMAIL ?? 'ops@urbeno.in',
    });
    await processEmailQueue(5).catch(() => undefined);
    await auditLog({ actorEmail: email, action: 'auth.reset.request', entity: 'user', entityId: email });
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
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Choose a password of at least 6 characters.');
  }

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

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await auditLog({
    actorEmail: email,
    actorId: user.id,
    action: 'auth.reset.confirm',
    entity: 'user',
    entityId: email,
  });

  return { ok: true };
}
