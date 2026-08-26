import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { sendSmtp, type SmtpConfig, normalizeSmtpTls } from '../lib/smtp.js';

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
  fromEmail: process.env.URBENO_EMAIL ?? 'noreply@urbeno.in',
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
    passwordSet: Boolean(resolveSmtpPass(s.pass)),
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  };
}

/** Prefer env/Secrets Manager; legacy DB pass only until the next Masters save clears it. */
function resolveSmtpPass(storedPass?: string): string {
  const fromEnv = process.env.SMTP_PASS?.trim();
  if (fromEnv) return fromEnv;
  return storedPass?.trim() || '';
}

function smtpFromEnv(): SmtpSettings {
  return {
    ...EMPTY,
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: resolveSmtpPass(),
    fromName: process.env.SMTP_FROM_NAME ?? EMPTY.fromName,
    fromEmail: process.env.SMTP_FROM_EMAIL ?? EMPTY.fromEmail,
    enabled: Boolean(process.env.SMTP_HOST),
  };
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  if (!row) return smtpFromEnv();

  const stored = parseSmtpSettings(row.value);
  // Masters "Send outgoing mail" checkbox is authoritative when a row exists.
  return {
    ...stored,
    pass: resolveSmtpPass(stored.pass),
  };
}

export async function saveSmtpSettings(
  input: Partial<SmtpSettings> & { pass?: string },
  actorEmail: string,
) {
  const prev = await getSmtpSettings();
  if (input.pass !== undefined && input.pass !== '') {
    // Password must live in SMTP_PASS (env / Secrets Manager), never in app_settings.
    if (!process.env.SMTP_PASS?.trim()) {
      throw new AppError(
        'SMTP password is not stored in the database. Set SMTP_PASS in the environment (or Secrets Manager), then save again without pasting the password.',
      );
    }
  }

  const next: SmtpSettings = {
    ...prev,
    enabled: input.enabled ?? prev.enabled,
    host: input.host !== undefined ? String(input.host).trim() : prev.host,
    port: input.port !== undefined ? Number(input.port) || 587 : prev.port,
    secure: input.secure ?? prev.secure,
    user: input.user !== undefined ? String(input.user).trim() : prev.user,
    pass: '', // never persist credentials
    fromName: input.fromName !== undefined ? String(input.fromName).trim() : prev.fromName,
    fromEmail: input.fromEmail !== undefined ? String(input.fromEmail).trim() : prev.fromEmail,
  };
  if (next.enabled && !next.host) throw new AppError('SMTP host is required when outgoing mail is enabled.');
  if (next.enabled && !next.fromEmail) throw new AppError('From address is required when outgoing mail is enabled.');
  if (next.enabled && !resolveSmtpPass()) {
    throw new AppError(
      'SMTP_PASS is not set. Configure the app password via environment or Secrets Manager before enabling outgoing mail.',
    );
  }

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
  return smtpPublicView({ ...next, pass: resolveSmtpPass() });
}

export const COMPANY_SETTING_KEY = 'company.profile';

export interface CompanyProfile {
  name: string;
  brand: string;
  address: string;
  gst: string;
  cin: string;
  phone: string;
  email: string;
  wa: string;
  cpcb: string;
  kspcb: string;
  r2: string;
  logoFileId: string | null;
}

export const DEFAULT_COMPANY: CompanyProfile = {
  name: process.env.URBENO_NAME ?? 'Urbeno Private Limited',
  brand: 'Recycling Heroes',
  address: process.env.URBENO_ADDRESS ?? 'Bengaluru, Karnataka, India',
  gst: process.env.URBENO_GST ?? '29AABCU1234R1ZX',
  cin: process.env.URBENO_CIN ?? '',
  phone: process.env.URBENO_PHONE ?? '1800-123-4567',
  email: process.env.URBENO_EMAIL ?? 'noreply@urbeno.in',
  wa: process.env.URBENO_WA ?? '919902299007',
  cpcb: process.env.URBENO_CPCB ?? 'CPCB/EPR/2022/KA/00817',
  kspcb: process.env.URBENO_KSPCB ?? 'KSPCB/HWM/AUTH/2024-27/1142',
  r2: process.env.URBENO_R2 ?? 'R2V3-2024-IN-0341',
  logoFileId: null,
};

export function parseCompanyProfile(raw: unknown): CompanyProfile {
  const d = asRecord(raw);
  return {
    name: String(d.name ?? DEFAULT_COMPANY.name).trim() || DEFAULT_COMPANY.name,
    brand: String(d.brand ?? DEFAULT_COMPANY.brand).trim(),
    address: String(d.address ?? DEFAULT_COMPANY.address).trim(),
    gst: String(d.gst ?? DEFAULT_COMPANY.gst).trim(),
    cin: String(d.cin ?? DEFAULT_COMPANY.cin).trim(),
    phone: String(d.phone ?? DEFAULT_COMPANY.phone).trim(),
    email: String(d.email ?? DEFAULT_COMPANY.email).trim(),
    wa: String(d.wa ?? DEFAULT_COMPANY.wa).trim(),
    cpcb: String(d.cpcb ?? DEFAULT_COMPANY.cpcb).trim(),
    kspcb: String(d.kspcb ?? DEFAULT_COMPANY.kspcb).trim(),
    r2: String(d.r2 ?? DEFAULT_COMPANY.r2).trim(),
    logoFileId: d.logoFileId ? String(d.logoFileId) : null,
  };
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const row = await prisma.appSetting.findUnique({ where: { key: COMPANY_SETTING_KEY } });
  if (!row) return { ...DEFAULT_COMPANY };
  return parseCompanyProfile(row.value);
}

export async function saveCompanyProfile(
  input: Partial<CompanyProfile>,
  actorEmail: string,
): Promise<CompanyProfile> {
  const prev = await getCompanyProfile();
  const next: CompanyProfile = {
    ...prev,
    name: input.name !== undefined ? String(input.name).trim() : prev.name,
    brand: input.brand !== undefined ? String(input.brand).trim() : prev.brand,
    address: input.address !== undefined ? String(input.address).trim() : prev.address,
    gst: input.gst !== undefined ? String(input.gst).trim() : prev.gst,
    cin: input.cin !== undefined ? String(input.cin).trim() : prev.cin,
    phone: input.phone !== undefined ? String(input.phone).trim() : prev.phone,
    email: input.email !== undefined ? String(input.email).trim() : prev.email,
    wa: input.wa !== undefined ? String(input.wa).trim() : prev.wa,
    cpcb: input.cpcb !== undefined ? String(input.cpcb).trim() : prev.cpcb,
    kspcb: input.kspcb !== undefined ? String(input.kspcb).trim() : prev.kspcb,
    r2: input.r2 !== undefined ? String(input.r2).trim() : prev.r2,
    logoFileId:
      input.logoFileId !== undefined
        ? input.logoFileId
          ? String(input.logoFileId)
          : null
        : prev.logoFileId,
  };
  if (!next.name) throw new AppError('Company name is required for the letterhead.');
  if (!next.address) throw new AppError('Complete address is required for the letterhead.');
  if (!next.gst) throw new AppError('GSTIN is required for the letterhead.');
  if (!next.cin) throw new AppError('CIN is required for the letterhead.');
  if (!next.phone) throw new AppError('Phone number is required for the letterhead.');

  if (next.logoFileId) {
    const { assertFilesExist } = await import('./file-service.js');
    await assertFilesExist([next.logoFileId], ['logo']);
  }

  await prisma.appSetting.upsert({
    where: { key: COMPANY_SETTING_KEY },
    create: {
      key: COMPANY_SETTING_KEY,
      value: next as unknown as Prisma.InputJsonValue,
      updatedBy: actorEmail,
    },
    update: {
      value: next as unknown as Prisma.InputJsonValue,
      updatedBy: actorEmail,
    },
  });
  return next;
}

export function toSmtpConfig(s: SmtpSettings): SmtpConfig | null {
  if (!s.enabled || !s.host) return null;
  return normalizeSmtpTls({
    host: s.host,
    port: s.port,
    secure: s.secure,
    user: s.user,
    pass: s.pass,
    fromName: s.fromName,
    fromEmail: s.fromEmail,
  });
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
