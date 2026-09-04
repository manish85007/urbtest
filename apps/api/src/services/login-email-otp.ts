import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { processEmailQueue, sendTransactionalEmail } from './email.js';
import { recordSecurityEvent } from './security-log.js';

const OTP_MINS = Number(process.env.LOGIN_EMAIL_OTP_MINS ?? 15);
export const EMAIL_VERIFY_DAYS = Number(process.env.EMAIL_VERIFY_DAYS ?? 90);

function sixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function allowDemoCode(): boolean {
  const env = process.env.NODE_ENV || '';
  return (
    env === 'development' ||
    env === 'uat' ||
    process.env.E2E_TEST === 'true' ||
    process.env.ALLOW_DEMO_OTP === 'true'
  );
}

export function emailOtpDue(emailVerifiedAt: Date | null | undefined): boolean {
  if (process.env.E2E_TEST === 'true' || process.env.NODE_ENV === 'test') return false;
  if (process.env.EMAIL_OTP_DISABLED === 'true') return false;
  if (!emailVerifiedAt) return true;
  const ageMs = Date.now() - emailVerifiedAt.getTime();
  return ageMs >= EMAIL_VERIFY_DAYS * 24 * 60 * 60 * 1000;
}

type OtpKind = 'login' | 'mfa';

async function issueEmailOtp(
  emailRaw: string,
  userName: string,
  kind: OtpKind,
): Promise<{ demoCode?: string | null }> {
  const email = emailRaw.trim().toLowerCase();
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
      expiresAt: new Date(Date.now() + OTP_MINS * 60 * 1000),
    },
  });

  const template = kind === 'mfa' ? 'mfa_email_otp' : 'login_email_otp';
  await sendTransactionalEmail(template, [email], {
    user_name: userName,
    code,
    expiry_minutes: OTP_MINS,
    days: EMAIL_VERIFY_DAYS,
    support_email: process.env.URBENO_EMAIL ?? 'info@urbeno.in',
  });
  await processEmailQueue(5).catch(() => undefined);

  await auditLog({
    actorEmail: email,
    action: kind === 'mfa' ? 'auth.mfa_email_otp.request' : 'auth.email_otp.request',
    entity: 'user',
    entityId: email,
  });
  await recordSecurityEvent(
    kind === 'mfa' ? 'auth.mfa_email_otp.sent' : 'auth.email_otp.sent',
    email,
    kind === 'mfa' ? {} : { days: EMAIL_VERIFY_DAYS },
  );

  return allowDemoCode() ? { demoCode: code } : {};
}

/** Issue a login email OTP (90-day mailbox check). */
export async function issueLoginEmailOtp(
  emailRaw: string,
  userName: string,
): Promise<{ demoCode?: string | null }> {
  return issueEmailOtp(emailRaw, userName, 'login');
}

/** Issue a two-factor email OTP (every sign-in when MFA method is email). */
export async function issueMfaEmailOtp(
  emailRaw: string,
  userName: string,
): Promise<{ demoCode?: string | null }> {
  return issueEmailOtp(emailRaw, userName, 'mfa');
}

export async function verifyLoginEmailOtp(emailRaw: string, code: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const row = await prisma.passwordReset.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new Error('No active email verification code. Sign in again to receive a new one.');
  if (row.expiresAt < new Date()) {
    await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    throw new Error(`That code expired. Codes are valid for ${OTP_MINS} minutes — sign in again.`);
  }
  const ok = await bcrypt.compare(String(code).trim(), row.codeHash);
  if (!ok) throw new Error('That email code is not correct. Check the message and try again.');
  await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
}

export const verifyMfaEmailOtp = verifyLoginEmailOtp;
