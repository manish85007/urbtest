import { UserRole } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { hashPassword } from './auth.js';
import type { SessionUser } from '../lib/auth-context.js';
import { sendTransactionalEmail } from './email.js';

export async function createClient(
  actor: SessionUser,
  input: { id: string; name: string; city?: string; contact?: string; phone?: string; email?: string },
) {
  const id = input.id.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(id)) {
    throw new AppError('Client ID must be 2–4 uppercase letters or digits.');
  }

  const client = await prisma.client.create({
    data: {
      id,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      contact: input.contact?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      createdBy: actor.email,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'client.create',
    entity: 'client',
    entityId: client.id,
  });

  return client;
}

export async function createSite(
  actor: SessionUser,
  clientId: string,
  input: { code: string; name: string; address?: string; gstin?: string; contactName?: string; contactPhone?: string },
) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('Client not found.');

  const site = await prisma.site.create({
    data: {
      clientId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      address: input.address?.trim() || null,
      gstin: input.gstin?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'site.create',
    entity: 'site',
    entityId: site.id,
    details: { clientId, code: site.code },
  });

  return site;
}

export async function createUser(
  actor: SessionUser,
  input: {
    email: string;
    name: string;
    role: UserRole;
    password?: string;
    clientId?: string | null;
    factoryIds?: string[];
    siteIds?: string[];
  },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('A user with this email already exists.');

  const passwordHash = await hashPassword(input.password?.trim() || 'demo');

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash,
      clientId: input.clientId ?? null,
      factoryIds: input.factoryIds ?? [],
      siteIds: input.siteIds ?? [],
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'user.create',
    entity: 'user',
    entityId: user.email,
    details: { role: user.role },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    factoryIds: user.factoryIds,
    siteIds: user.siteIds,
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      factoryIds: true,
      active: true,
    },
  });
}

export async function updateClient(
  actor: SessionUser,
  clientId: string,
  input: {
    name?: string;
    city?: string;
    contact?: string;
    phone?: string;
    email?: string;
    payTermsDays?: number;
    logoFileId?: string | null;
    active?: boolean;
  },
) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('Client not found.');

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      name: input.name?.trim() || undefined,
      city: input.city !== undefined ? input.city.trim() || null : undefined,
      contact: input.contact !== undefined ? input.contact.trim() || null : undefined,
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      email: input.email !== undefined ? input.email.trim().toLowerCase() || null : undefined,
      payTermsDays: input.payTermsDays,
      logoFileId: input.logoFileId !== undefined ? input.logoFileId : undefined,
      active: input.active,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'client.update',
    entity: 'client',
    entityId: clientId,
  });
  return updated;
}

export async function updateSite(
  actor: SessionUser,
  siteId: string,
  input: { name?: string; address?: string; gstin?: string; active?: boolean },
) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new AppError('Site not found.');

  if (input.active === false) {
    const used = await prisma.submission.count({ where: { siteId } });
    if (used > 0 && input.active === false) {
      // A3 — deactivate, never delete
    }
  }

  const updated = await prisma.site.update({
    where: { id: siteId },
    data: {
      name: input.name?.trim() || undefined,
      address: input.address !== undefined ? input.address.trim() || null : undefined,
      gstin: input.gstin !== undefined ? input.gstin.trim() || null : undefined,
      active: input.active,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: input.active === false ? 'site.deactivate' : 'site.update',
    entity: 'site',
    entityId: siteId,
  });
  return updated;
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  input: {
    name?: string;
    role?: UserRole;
    clientId?: string | null;
    factoryIds?: string[];
    siteIds?: string[];
    active?: boolean;
    password?: string;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError('User not found.');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim() || undefined,
      role: input.role,
      clientId: input.clientId === undefined ? undefined : input.clientId,
      factoryIds: input.factoryIds,
      siteIds: input.siteIds,
      active: input.active,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      factoryIds: true,
      active: true,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'user.update',
    entity: 'user',
    entityId: existing.email,
  });
  return updated;
}

export async function upsertFactory(
  actor: SessionUser,
  input: {
    id: string;
    name: string;
    address?: string;
    gstin?: string;
    kspcbConsent?: string;
    cpcbEpr?: string;
    active?: boolean;
  },
) {
  const id = input.id.trim().toUpperCase();
  const factory = await prisma.factorySite.upsert({
    where: { id },
    create: {
      id,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      gstin: input.gstin?.trim() || null,
      kspcbConsent: input.kspcbConsent?.trim() || null,
      cpcbEpr: input.cpcbEpr?.trim() || null,
      active: input.active ?? true,
    },
    update: {
      name: input.name.trim(),
      address: input.address !== undefined ? input.address.trim() || null : undefined,
      gstin: input.gstin !== undefined ? input.gstin.trim() || null : undefined,
      kspcbConsent: input.kspcbConsent !== undefined ? input.kspcbConsent.trim() || null : undefined,
      cpcbEpr: input.cpcbEpr !== undefined ? input.cpcbEpr.trim() || null : undefined,
      active: input.active,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'factory.upsert',
    entity: 'factory',
    entityId: factory.id,
  });
  return factory;
}

export async function upsertCategory(
  actor: SessionUser,
  input: {
    factoryId: string;
    entryId: string;
    description: string;
    groupCode: string;
    capacityTpa: number;
    activity?: string;
    authRef?: string;
    active?: boolean;
  },
) {
  const existing = await prisma.categoryMaster.findUnique({
    where: { factoryId_entryId: { factoryId: input.factoryId, entryId: input.entryId } },
  });

  const row = existing
    ? await prisma.categoryMaster.update({
        where: { id: existing.id },
        data: {
          description: input.description.trim(),
          groupCode: input.groupCode,
          capacityTpa: input.capacityTpa,
          activity: input.activity ?? undefined,
          authRef: input.authRef !== undefined ? input.authRef : undefined,
          active: input.active,
        },
      })
    : await prisma.categoryMaster.create({
        data: {
          factoryId: input.factoryId,
          entryId: input.entryId.trim(),
          description: input.description.trim(),
          groupCode: input.groupCode,
          capacityTpa: input.capacityTpa,
          activity: input.activity ?? 'Recycling',
          authRef: input.authRef ?? null,
          createdBy: actor.email,
        },
      });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: existing ? 'category.update' : 'category.create',
    entity: 'category',
    entityId: `${input.factoryId}:${input.entryId}`,
  });
  return row;
}

export async function listEmailTemplates() {
  return prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } });
}

export async function createEmailTemplate(
  actor: SessionUser,
  input: { key: string; name: string; subject: string; body: string },
) {
  const key = input.key.trim().toLowerCase().replace(/\s+/g, '_');
  const existing = await prisma.emailTemplate.findUnique({ where: { key } });
  if (existing) throw new AppError('A template with this key already exists.');

  const tpl = await prisma.emailTemplate.create({
    data: {
      key,
      name: input.name.trim(),
      subject: input.subject,
      body: input.body,
      editable: true,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'email.template.create',
    entity: 'email_template',
    entityId: key,
  });
  return tpl;
}

export async function updateEmailTemplate(
  actor: SessionUser,
  key: string,
  input: { name?: string; subject?: string; body?: string },
) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!tpl) throw new AppError('Template not found.');
  if (!tpl.editable) throw new AppError('This transactional template is locked.');

  const updated = await prisma.emailTemplate.update({
    where: { key },
    data: {
      name: input.name?.trim() || undefined,
      subject: input.subject,
      body: input.body,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'email.template.update',
    entity: 'email_template',
    entityId: key,
  });
  return updated;
}

export async function sendCampaign(actor: SessionUser, key: string, to: string[]) {
  const recipients = to.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!recipients.length) throw new AppError('Select at least one recipient.');
  const rec = await sendTransactionalEmail(key, recipients, {
    contact_name: 'Colleague',
    client_name: 'Urbeno',
  });
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'email.campaign',
    entity: 'email',
    entityId: key,
    details: { count: recipients.length },
  });
  return { queued: !!rec, to: recipients };
}
