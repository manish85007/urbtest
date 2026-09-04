import bcrypt from 'bcryptjs';
import {
  MFA_GRACE_DAYS,
  PW_POLICY,
  mfaEnrolForced,
  mfaGraceDaysLeft,
  mfaRequired,
  pwAgeDays,
  pwCheck,
  pwExpired,
  pwNeedsMessage,
  pwPolicyText,
  pwReusedMessage,
} from '@urb-tectrack/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { newTotpSecret, totpCode, totpUri, verifyTotp } from '../lib/totp.js';
import { auditLog } from './audit.js';
import { recordSecurityEvent } from './security-log.js';
import type { SessionUser } from '../lib/auth-context.js';
import { enrichSessionUser } from '../lib/auth-context.js';
import {
  emailOtpDue,
  issueLoginEmailOtp,
  issueMfaEmailOtp,
  verifyLoginEmailOtp,
  verifyMfaEmailOtp,
} from './login-email-otp.js';

const LOCK_ATTEMPTS = PW_POLICY.lockAfter;
const LOCK_WINDOW_MS = PW_POLICY.lockWindowMins * 60 * 1000;
const SESSION_HOURS = 8;

export type MfaMethod = 'totp' | 'email';

export type SecurityStatus = {
  mustChangePassword: boolean;
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  mfaEnrolForced: boolean;
  mfaGraceDaysLeft: number | null;
  mfaGraceDays: number;
  passwordExpired: boolean;
};

export class AuthError extends Error {
  mfaRequired = false;
  mfaMethod: MfaMethod | null = null;
  emailOtpRequired = false;
  demoCode?: string | null;
  constructor(
    message: string,
    opts?: {
      mfaRequired?: boolean;
      mfaMethod?: MfaMethod | null;
      emailOtpRequired?: boolean;
      demoCode?: string | null;
    },
  ) {
    super(message);
    this.name = 'AuthError';
    this.mfaRequired = !!opts?.mfaRequired;
    this.mfaMethod = opts?.mfaMethod ?? null;
    this.emailOtpRequired = !!opts?.emailOtpRequired;
    this.demoCode = opts?.demoCode;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function assertPasswordPolicy(email: string, password: string, userId?: string) {
  const fails = pwCheck(password, email);
  if (fails.length) throw new AppError(pwNeedsMessage(fails));
  if (userId) {
    const hist = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PW_POLICY.historyDepth,
    });
    for (const h of hist) {
      if (await bcrypt.compare(password, h.passwordHash)) {
        throw new AppError(pwReusedMessage());
      }
    }
  }
}

export async function rememberPassword(userId: string, passwordHash: string) {
  await prisma.passwordHistory.create({ data: { userId, passwordHash } });
  const extra = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: PW_POLICY.historyDepth,
    select: { id: true },
  });
  if (extra.length) {
    await prisma.passwordHistory.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
  }
}

/** User-chosen password — clears the mandatory-reset flag. */
export async function applyPassword(userId: string, email: string, password: string) {
  await assertPasswordPolicy(email, password, userId);
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordSetAt: new Date(), mustReset: false },
  });
  await rememberPassword(userId, passwordHash);
  return passwordHash;
}

/** Temporary / bootstrap password — user must change it on next sign-in. */
export async function applyTempPassword(userId: string, email: string, password: string) {
  await assertPasswordPolicy(email, password, userId);
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordSetAt: new Date(), mustReset: true },
  });
  await rememberPassword(userId, passwordHash);
  return passwordHash;
}

function isMfaEnrolled(user: { mfaSecret: string | null; mfaMethod: string | null }): boolean {
  return user.mfaMethod === 'email' || !!user.mfaSecret;
}

export function buildSecurityStatus(user: {
  role: string;
  createdAt: Date;
  mustReset: boolean;
  passwordSetAt: Date | null;
  mfaSecret: string | null;
  mfaMethod: string | null;
}): SecurityStatus {
  const enrolled = isMfaEnrolled(user);
  const passwordExpired = pwExpired(user.passwordSetAt);
  // Local/UAT capture & automation: E2E_TEST skips the hard enrol gate so scripts can
  // walk the UI without mutating account createdAt. Login MFA still applies if enrolled.
  const e2e = process.env.E2E_TEST === 'true';
  return {
    mustChangePassword: user.mustReset || passwordExpired,
    mfaRequired: mfaRequired(user.role),
    mfaEnrolled: enrolled,
    mfaEnrolForced: e2e ? false : mfaEnrolForced(user.role, user.createdAt, enrolled),
    mfaGraceDaysLeft: mfaGraceDaysLeft(user.role, user.createdAt, enrolled),
    mfaGraceDays: MFA_GRACE_DAYS,
    passwordExpired,
  };
}

export async function securityStatusFor(actor: SessionUser): Promise<SecurityStatus> {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) {
    return {
      mustChangePassword: false,
      mfaRequired: false,
      mfaEnrolled: false,
      mfaEnrolForced: false,
      mfaGraceDaysLeft: null,
      mfaGraceDays: MFA_GRACE_DAYS,
      passwordExpired: false,
    };
  }
  return buildSecurityStatus(user);
}

export async function signIn(
  email: string,
  password: string,
  mfaCode?: string,
  userAgent?: string,
  emailOtp?: string,
): Promise<{ user: SessionUser; token: string; security: SecurityStatus }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordSecurityEvent(
      'auth.locked.attempt',
      normalized,
      { minutesRemaining: mins },
      'high',
      userAgent,
    );
    throw new AuthError(
      `Account locked after ${LOCK_ATTEMPTS} failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
    );
  }

  const valid = user?.active && user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!valid || !user) {
    let attempts = 0;
    let locked = false;
    if (user) {
      attempts = user.failedLoginCount + 1;
      locked = attempts >= LOCK_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: locked
          ? {
              failedLoginCount: 0,
              lockedUntil: new Date(Date.now() + LOCK_WINDOW_MS),
            }
          : { failedLoginCount: attempts },
      });
    }
    await auditLog({
      actorEmail: normalized,
      action: 'auth.fail',
      entity: 'user',
      entityId: normalized,
      details: { attempts },
    });
    await recordSecurityEvent(
      'auth.failed',
      normalized,
      { attempts, known: !!user },
      locked ? 'high' : 'warn',
      userAgent,
    );
    if (locked) {
      await recordSecurityEvent(
        'auth.lockout',
        normalized,
        { minutes: PW_POLICY.lockWindowMins },
        'high',
        userAgent,
      );
    }
    throw new AuthError('Incorrect email or password.');
  }

  const mfaMethod: MfaMethod | null =
    user.mfaMethod === 'email' ? 'email' : user.mfaSecret ? 'totp' : null;

  if (mfaMethod === 'totp' && user.mfaSecret) {
    if (!mfaCode?.trim()) {
      throw new AuthError('Enter the six-digit code from your authenticator.', {
        mfaRequired: true,
        mfaMethod: 'totp',
      });
    }
    if (!verifyTotp(user.mfaSecret, mfaCode)) {
      await recordSecurityEvent('mfa.failed', user.email, { method: 'totp' }, 'warn', userAgent);
      throw new AuthError('That code is not right. It changes every 30 seconds — try the current one.', {
        mfaRequired: true,
        mfaMethod: 'totp',
      });
    }
    await recordSecurityEvent('mfa.verified', user.email, { method: 'totp' }, 'info', userAgent);
  } else if (mfaMethod === 'email') {
    if (!mfaCode?.trim()) {
      const issued = await issueMfaEmailOtp(user.email, user.name);
      throw new AuthError('Enter the six-digit code we just emailed you.', {
        mfaRequired: true,
        mfaMethod: 'email',
        demoCode: issued.demoCode,
      });
    }
    try {
      await verifyMfaEmailOtp(user.email, mfaCode);
    } catch (err) {
      await recordSecurityEvent('mfa.failed', user.email, { method: 'email' }, 'warn', userAgent);
      throw new AuthError(err instanceof Error ? err.message : 'Email two-factor failed.', {
        mfaRequired: true,
        mfaMethod: 'email',
      });
    }
    await recordSecurityEvent('mfa.verified', user.email, { method: 'email' }, 'info', userAgent);
  }

  // Periodic email OTP — confirms the mailbox still works and the user remains reachable.
  const needsEmailOtp = emailOtpDue(user.emailVerifiedAt);
  if (needsEmailOtp) {
    if (!emailOtp?.trim()) {
      const issued = await issueLoginEmailOtp(user.email, user.name);
      throw new AuthError(
        'Enter the 6-digit code we just emailed you. This check runs every 90 days to confirm your work email still works.',
        { emailOtpRequired: true, demoCode: issued.demoCode },
      );
    }
    try {
      await verifyLoginEmailOtp(user.email, emailOtp);
    } catch (err) {
      await recordSecurityEvent('auth.email_otp.failed', user.email, {}, 'warn', userAgent);
      throw new AuthError(err instanceof Error ? err.message : 'Email verification failed.', {
        emailOtpRequired: true,
      });
    }
    await recordSecurityEvent('auth.email_otp.verified', user.email, {}, 'info', userAgent);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const security = buildSecurityStatus(user);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        ...(needsEmailOtp ? { emailVerifiedAt: new Date() } : {}),
      },
    }),
    prisma.session.create({ data: { userId: user.id, token, expiresAt } }),
  ]);

  await auditLog({
    actorEmail: user.email,
    actorId: user.id,
    action: 'auth.login',
    entity: 'user',
    entityId: user.email,
  });
  await recordSecurityEvent('auth.success', user.email, {}, 'info', userAgent);
  if (security.passwordExpired) {
    await recordSecurityEvent('auth.password.expired', user.email, {}, 'warn', userAgent);
  }
  if (security.mustChangePassword) {
    await recordSecurityEvent('auth.password.must_reset', user.email, {}, 'warn', userAgent);
  }
  if (security.mfaEnrolForced) {
    await recordSecurityEvent('mfa.enrol.forced', user.email, { graceDays: MFA_GRACE_DAYS }, 'high', userAgent);
  }

  return { user: await enrichSessionUser(user), token, security };
}

export async function signOut(token: string, actor?: SessionUser) {
  await prisma.session.deleteMany({ where: { token } });
  if (actor) {
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'auth.logout',
      entity: 'user',
      entityId: actor.email,
    });
    await recordSecurityEvent('auth.logout', actor.email, {});
  }
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return enrichSessionUser(session.user);
}

export async function changePassword(actor: SessionUser, current: string, next: string) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new AppError('User not found');

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) {
    await recordSecurityEvent('auth.pwchange.failed', actor.email, {}, 'warn');
    throw new AppError('Current password is not correct.');
  }

  await applyPassword(user.id, user.email, next);
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'auth.password_change',
    entity: 'user',
    entityId: actor.email,
  });
  await recordSecurityEvent('auth.password.changed', actor.email, {});
  return { ok: true };
}

export async function startMfaEnrol(actor: SessionUser, method: MfaMethod = 'totp') {
  if (method === 'email') {
    const issued = await issueMfaEmailOtp(actor.email, actor.name);
    return {
      method: 'email' as const,
      required: mfaRequired(actor.role),
      demoCode: issued.demoCode ?? null,
    };
  }
  const secret = newTotpSecret();
  const uri = totpUri(actor.email, secret);
  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: { dark: '#1a2e14', light: '#ffffff' },
  });
  return {
    method: 'totp' as const,
    secret,
    uri,
    qrDataUrl,
    required: mfaRequired(actor.role),
  };
}

export async function confirmMfaEnrol(
  actor: SessionUser,
  opts: { method?: MfaMethod; secret?: string; code: string },
) {
  const method = opts.method ?? 'totp';
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new AppError('User not found');

  if (method === 'email') {
    try {
      await verifyMfaEmailOtp(user.email, opts.code);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : 'Email two-factor failed.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: null, mfaMethod: 'email', mfaAt: new Date() },
    });
  } else {
    if (!opts.secret?.trim()) throw new AppError('Authenticator secret is required.');
    if (!verifyTotp(opts.secret, opts.code)) {
      throw new AppError('That code is not right. It changes every 30 seconds — try the current one.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: opts.secret, mfaMethod: 'totp', mfaAt: new Date() },
    });
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'mfa.enrol',
    entity: 'user',
    entityId: actor.email,
    details: { method },
  });
  await recordSecurityEvent('mfa.enrolled', actor.email, { method });
  return { ok: true, enrolled: true, method };
}

export async function disableMfa(actor: SessionUser, reason: string) {
  if (mfaRequired(actor.role)) {
    throw new AppError(
      `Two-factor authentication is mandatory for ${actor.role} accounts and cannot be turned off.`,
    );
  }
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new AppError('User not found');
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: null, mfaMethod: null, mfaAt: null },
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'mfa.disable',
    entity: 'user',
    entityId: actor.email,
    details: { reason },
  });
  await recordSecurityEvent('mfa.disabled', actor.email, { reason }, 'high');
  return { ok: true, enrolled: false };
}

export async function mfaStatus(actor: SessionUser) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  const method: MfaMethod | null =
    user?.mfaMethod === 'email' ? 'email' : user?.mfaSecret ? 'totp' : null;
  const enrolled = user ? isMfaEnrolled(user) : false;
  const security = user
    ? buildSecurityStatus(user)
    : {
        mustChangePassword: false,
        mfaRequired: mfaRequired(actor.role),
        mfaEnrolled: false,
        mfaEnrolForced: false,
        mfaGraceDaysLeft: null,
        mfaGraceDays: MFA_GRACE_DAYS,
        passwordExpired: false,
      };
  return {
    required: security.mfaRequired,
    enrolled,
    method,
    enrolledAt: user?.mfaAt?.toISOString() ?? null,
    passwordAgeDays: pwAgeDays(user?.passwordSetAt ?? null),
    passwordExpired: security.passwordExpired,
    mustChangePassword: security.mustChangePassword,
    mfaEnrolForced: security.mfaEnrolForced,
    mfaGraceDaysLeft: security.mfaGraceDaysLeft,
    mfaGraceDays: MFA_GRACE_DAYS,
    policyText: pwPolicyText(),
  };
}

/** Test helper — current TOTP for a stored secret. */
export function currentMfaCode(secret: string): string {
  return totpCode(secret);
}
