import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { sendSmtp, type SmtpConfig } from '../lib/smtp.js';

export const SMTP_SETTING_KEY = 'email.smtp';

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

const EMPTY: SmtpSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Urb TecTrack',
  fromEmail: process.env.URBENO_EMAIL ?? 'ops@urbeno.in',
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function parseSmtpSettings(raw: unknown): SmtpSettings {
  const d = asRecord(raw);
  return {
    enabled: Boolean(d.enabled),
    host: String(d.host ?? ''),
    port: Number(d.port) || 587,
    secure: Boolean(d.secure),
    user: String(d.user ?? ''),
    pass: String(d.pass ?? ''),
    fromName: String(d.fromName ?? EMPTY.fromName),
    fromEmail: String(d.fromEmail ?? EMPTY.fromEmail),
  };
}

export function smtpPublicView(s: SmtpSettings) {
  return {
    enabled: s.enabled,
    host: s.host,
    port: s.port,
    secure: s.secure,
    user: s.user,
    passwordSet: Boolean(s.pass),
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  };
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  if (!row) {
    return {
      ...EMPTY,
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      fromName: process.env.SMTP_FROM_NAME ?? EMPTY.fromName,
      fromEmail: process.env.SMTP_FROM_EMAIL ?? EMPTY.fromEmail,
      enabled: Boolean(process.env.SMTP_HOST),
    };
  }
  return parseSmtpSettings(row.value);
}

export async function saveSmtpSettings(
  input: Partial<SmtpSettings> & { pass?: string },
  actorEmail: string,
) {
  const prev = await getSmtpSettings();
  const next: SmtpSettings = {
    ...prev,
    enabled: input.enabled ?? prev.enabled,
    host: input.host !== undefined ? String(input.host).trim() : prev.host,
    port: input.port !== undefined ? Number(input.port) || 587 : prev.port,
    secure: input.secure ?? prev.secure,
    user: input.user !== undefined ? String(input.user).trim() : prev.user,
    pass: input.pass !== undefined && input.pass !== '' ? input.pass : prev.pass,
    fromName: input.fromName !== undefined ? String(input.fromName).trim() : prev.fromName,
    fromEmail: input.fromEmail !== undefined ? String(input.fromEmail).trim() : prev.fromEmail,
  };
  if (next.enabled && !next.host) throw new AppError('SMTP host is required when outgoing mail is enabled.');
  if (next.enabled && !next.fromEmail) throw new AppError('From address is required when outgoing mail is enabled.');

  await prisma.appSetting.upsert({
    where: { key: SMTP_SETTING_KEY },
    create: {
      key: SMTP_SETTING_KEY,
      value: next as unknown as Prisma.InputJsonValue,
      updatedBy: actorEmail,
    },
    update: {
      value: next as unknown as Prisma.InputJsonValue,
      updatedBy: actorEmail,
    },
  });
  return smtpPublicView(next);
}

export function toSmtpConfig(s: SmtpSettings): SmtpConfig | null {
  if (!s.enabled || !s.host) return null;
  return {
    host: s.host,
    port: s.port,
    secure: s.secure || s.port === 465,
    user: s.user,
    pass: s.pass,
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  };
}

export async function sendTestEmail(to: string) {
  const cfg = toSmtpConfig(await getSmtpSettings());
  if (!cfg) throw new AppError('Save and enable SMTP settings before sending a test.');
  try {
    await sendSmtp(cfg, {
      to: [to],
      subject: 'Urb TecTrack — outgoing mail test',
      body: 'This is a test message from Urb TecTrack Masters → Email & Templates → Outgoing mail.',
    });
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : 'SMTP send failed.', 400);
  }
}
