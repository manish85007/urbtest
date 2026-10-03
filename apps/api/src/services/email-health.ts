import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { verifySmtpLogin } from '../lib/smtp.js';
import { getSmtpSettings, toSmtpConfig } from './settings.js';

const HEALTH_KEY = 'email.health';

export type EmailHealthSource = 'probe' | 'delivery';

export interface EmailHealthState {
  ok: boolean;
  checkedAt: string;
  source: EmailHealthSource;
  error: string | null;
  /** First failure of the current outage; null while healthy. */
  failingSince: string | null;
  lastOkAt: string | null;
}

export interface EmailHealthReport extends EmailHealthState {
  configured: boolean;
  queued: number;
  failedLast24h: number;
  lastSentAt: string | null;
  hint: string | null;
}

let cached: EmailHealthState | null = null;

function isAuthFailure(error: string | null | undefined): boolean {
  return !!error && /\b535\b|BadCredentials|Username and Password not accepted|authentication failed/i.test(error);
}

function hintFor(error: string | null): string | null {
  if (!error) return null;
  if (isAuthFailure(error)) {
    return 'The mail server rejected the SMTP login. For Gmail, create a new App Password for the sender account, add it as a new version of the SMTP_PASS secret, then redeploy so the service picks it up.';
  }
  if (/timed out|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(error)) {
    return 'The mail server could not be reached. Check the SMTP host/port under Masters → Email & Templates → Outgoing mail.';
  }
  if (/requires SMTP|not configured/i.test(error)) {
    return 'Outgoing mail is not configured. Enable SMTP under Masters → Email & Templates → Outgoing mail.';
  }
  return null;
}

async function readState(): Promise<EmailHealthState | null> {
  if (cached) return cached;
  const row = await prisma.appSetting.findUnique({ where: { key: HEALTH_KEY } });
  cached = (row?.value as unknown as EmailHealthState | undefined) ?? null;
  return cached;
}

async function writeState(state: EmailHealthState) {
  cached = state;
  const value = state as unknown as Prisma.InputJsonValue;
  await prisma.appSetting.upsert({
    where: { key: HEALTH_KEY },
    create: { key: HEALTH_KEY, value },
    update: { value },
  });
}

/**
 * Record an SMTP outcome. Persists on state change (and on every probe) so
 * busy send paths do not write the settings row for each message.
 */
export async function recordEmailHealth(
  ok: boolean,
  error: string | null,
  source: EmailHealthSource,
): Promise<EmailHealthState> {
  const prev = await readState().catch(() => null);
  const now = new Date().toISOString();
  const next: EmailHealthState = {
    ok,
    checkedAt: now,
    source,
    error: ok ? null : (error ?? 'Unknown SMTP error').slice(0, 500),
    failingSince: ok ? null : (prev && !prev.ok && prev.failingSince) || now,
    lastOkAt: ok ? now : (prev?.lastOkAt ?? null),
  };

  if (!ok) {
    // Cloud Monitoring alert policy matches jsonPayload.alert="smtp_down".
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        alert: 'smtp_down',
        message: `Outgoing email is failing (${source}): ${next.error}`,
        failingSince: next.failingSince,
        authFailure: isAuthFailure(next.error),
      }),
    );
  } else if (prev && !prev.ok) {
    console.log(
      JSON.stringify({
        severity: 'NOTICE',
        alert: 'smtp_recovered',
        message: `Outgoing email recovered after failing since ${prev.failingSince}`,
      }),
    );
  }

  const changed = !prev || prev.ok !== ok || prev.error !== next.error;
  if (changed || source === 'probe') await writeState(next).catch(() => undefined);
  return next;
}

/** Log in to SMTP (no message sent) and record the result. */
export async function runEmailHealthCheck(): Promise<EmailHealthState> {
  const cfg = toSmtpConfig(await getSmtpSettings());
  if (!cfg) {
    const provider = process.env.EMAIL_PROVIDER ?? 'console';
    if (provider === 'console' && process.env.NODE_ENV !== 'production') {
      return recordEmailHealth(true, null, 'probe');
    }
    return recordEmailHealth(
      false,
      'Outgoing mail requires SMTP, but SMTP is disabled or not configured.',
      'probe',
    );
  }
  try {
    await verifySmtpLogin(cfg);
    return recordEmailHealth(true, null, 'probe');
  } catch (err) {
    return recordEmailHealth(false, err instanceof Error ? err.message : 'SMTP login failed', 'probe');
  }
}

export async function getEmailHealth(): Promise<EmailHealthReport> {
  cached = null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [state, settings, queued, failedLast24h, lastSent] = await Promise.all([
    readState(),
    getSmtpSettings(),
    prisma.emailOutbox.count({ where: { status: 'queued' } }),
    prisma.emailOutbox.count({ where: { status: 'failed', createdAt: { gte: since } } }),
    prisma.emailOutbox.findFirst({
      where: { status: 'sent' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
  ]);
  const base: EmailHealthState = state ?? {
    ok: true,
    checkedAt: new Date(0).toISOString(),
    source: 'probe',
    error: null,
    failingSince: null,
    lastOkAt: null,
  };
  return {
    ...base,
    configured: !!toSmtpConfig(settings),
    queued,
    failedLast24h,
    lastSentAt: lastSent?.sentAt?.toISOString() ?? null,
    hint: hintFor(base.error),
  };
}
