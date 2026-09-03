import { Prisma, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { gstinError, treesEarned } from '@urb-tectrack/shared';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { applyPassword, assertPasswordPolicy, hashPassword } from './auth.js';
import type { SessionUser } from '../lib/auth-context.js';
import { sendTransactionalEmail } from './email.js';
import { recordSecurityEvent } from './security-log.js';

const RESERVED_CLIENT_PREFIX = /^(URB|ADM|SYS|TEST)/;

export type SiteInput = {
  code: string;
  name: string;
  address?: string;
  gstin?: string;
  city?: string;
  state?: string;
  pin?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export function validClientCode(code: string, taken?: boolean): string | null {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(c)) return 'Client ID must be exactly 4 uppercase letters or digits.';
  if (RESERVED_CLIENT_PREFIX.test(c)) return 'That prefix is reserved for Urbeno internal use.';
  if (taken) return `Client ID ${c} is already taken.`;
  return null;
}

function siteData(input: SiteInput) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const gstin = input.gstin?.trim().toUpperCase() || '';
  const address = input.address?.trim() || '';
  if (!code || !name || !gstin || !address) {
    throw new AppError('Site code, name, GST and address are all required.');
  }
  const gstErr = gstinError(gstin);
  if (gstErr) throw new AppError(gstErr);
  return {
    code,
    name,
    address,
    gstin,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    pin: input.pin?.trim() || null,
    contactName: input.contactName?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    contactEmail: input.contactEmail?.trim().toLowerCase() || null,
  };
}

export async function createClient(
  actor: SessionUser,
  input: {
    id: string;
    name: string;
    city?: string;
    contact?: string;
    phone?: string;
    email?: string;
    payTermsDays?: number;
    logoFileId?: string | null;
    showPortalLogo?: boolean;
    sites?: SiteInput[];
  },
) {
  const id = input.id.trim().toUpperCase();
  const existing = await prisma.client.findUnique({ where: { id } });
  const err = validClientCode(id, !!existing);
  if (err) throw new AppError(err);

  const name = input.name.trim();
  if (!name) throw new AppError('Client legal name is required.');

  const sites = (input.sites ?? []).filter((s) => s.code && s.name && s.gstin && s.address);
  if (!sites.length) {
    throw new AppError('Add at least one site with a code, name, GST and address.');
  }

  try {
    const client = await prisma.client.create({
      data: {
        id,
        name,
        city: input.city?.trim() || null,
        contact: input.contact?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        payTermsDays: input.payTermsDays ?? 30,
        logoFileId: input.logoFileId ?? null,
        showPortalLogo: input.showPortalLogo === true,
        createdBy: actor.email,
        sites: { create: sites.map(siteData) },
      },
      include: { sites: true },
    });

    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'client.create',
      entity: 'client',
      entityId: client.id,
      details: { name: client.name, sites: client.sites.length },
    });

    return client;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Client ID ${id} is already taken.`);
    }
    throw e;
  }
}

export async function createSite(actor: SessionUser, clientId: string, input: SiteInput) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('Client not found.');

  const data = siteData(input);
  const dup = await prisma.site.findUnique({
    where: { clientId_code: { clientId, code: data.code } },
  });
  if (dup) throw new AppError(`Site code ${data.code} already exists for this client.`);

  const site = await prisma.site.create({ data: { clientId, ...data } });

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

/** Same password as seeded demo accounts — used so testers can sign in immediately. */
function tempPassword() {
  return 'demo';
}

/** Policy-compliant temporary password for admin-initiated resets (shown to admin; email optional). */
export function generateAdminTempPassword(): string {
  const chunk = randomBytes(5).toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  return `Tmp${chunk}9A`;
}

/**
 * Super Admin password reset for any user — supports cases where email OTP is unavailable.
 * Returns the temporary password so the admin can share it securely out-of-band.
 */
export async function adminResetUserPassword(actor: SessionUser, userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError('User not found.');
  if (!existing.active) throw new AppError('Cannot reset password for a disabled account. Re-activate the user first.');

  const tmp = generateAdminTempPassword();
  await applyPassword(existing.id, existing.email, tmp);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: existing.id } }),
    prisma.user.update({
      where: { id: existing.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    }),
  ]);

  let emailSent = false;
  try {
    const queued = await sendTransactionalEmail('user_welcome', [existing.email], {
      user_name: existing.name,
      user_email: existing.email,
      client_name: 'Urbeno',
      temp_password: tmp,
      admin_name: actor.name,
    });
    emailSent = !!queued;
  } catch {
    emailSent = false;
  }
  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'user.password.reset',
    entity: 'user',
    entityId: existing.email,
    details: { emailSent },
  });
  await recordSecurityEvent('auth.password.admin_reset', existing.email, {
    by: actor.email,
    emailSent,
  });

  return {
    ok: true as const,
    email: existing.email,
    name: existing.name,
    tempPassword: tmp,
    emailSent,
  };
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
    featureAccess?: Record<string, boolean> | null;
  },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(`A user with email ${email} already exists.`);
  if (input.role === 'client' && !input.clientId) {
    throw new AppError('Select which client this user belongs to.');
  }

  const tmp = input.password?.trim() || tempPassword();
  if (tmp !== 'demo') await assertPasswordPolicy(email, tmp);
  const passwordHash = await hashPassword(tmp);

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      role: input.role,
      passwordHash,
      clientId: input.role === 'client' ? input.clientId ?? null : null,
      factoryIds: input.role === 'factory' ? input.factoryIds ?? [] : [],
      siteIds: input.role === 'client' ? input.siteIds ?? [] : [],
      featureAccess: input.featureAccess ?? Prisma.JsonNull,
    },
  });

  const clientName =
    user.clientId
      ? (await prisma.client.findUnique({ where: { id: user.clientId }, select: { name: true } }))?.name
      : 'Urbeno';

  await sendTransactionalEmail('user_welcome', [email], {
    user_name: user.name,
    user_email: email,
    client_name: clientName ?? 'Urbeno',
    temp_password: tmp,
    admin_name: actor.name,
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
    tempPassword: tmp,
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
      siteIds: true,
      active: true,
      featureAccess: true,
    },
  });
}

export async function listClientsForMasters(includeInactive = false) {
  const clients = await prisma.client.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: 'asc' },
    include: {
      sites: { select: { active: true } },
      _count: { select: { submissions: true } },
    },
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    contact: c.contact,
    phone: c.phone,
    email: c.email,
    active: c.active,
    payTermsDays: c.payTermsDays,
    logoFileId: c.logoFileId,
    showPortalLogo: c.showPortalLogo,
    siteActive: c.sites.filter((s) => s.active).length,
    siteInactive: c.sites.filter((s) => !s.active).length,
    requestCount: c._count.submissions,
  }));
}

/** Active client portal users who can access a given site (empty siteIds = all sites). */
export async function listClientPortalUsersForSite(clientId: string, siteId: string) {
  const site = await prisma.site.findFirst({ where: { id: siteId, clientId, active: true } });
  if (!site) throw new AppError('Site not found for this client.', 404);

  const users = await prisma.user.findMany({
    where: { clientId, role: 'client', active: true },
    orderBy: { name: 'asc' },
    select: { id: true, email: true, name: true, siteIds: true },
  });

  return users
    .filter((u) => !u.siteIds.length || u.siteIds.includes(siteId))
    .map(({ id, email, name }) => ({ id, email, name }));
}

export async function getClientDetail(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      sites: { orderBy: { code: 'asc' } },
      users: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          siteIds: true,
          active: true,
        },
      },
    },
  });
  if (!client) throw new AppError('Client not found.', 404);

  const [requestCount, openCount, closedAgg, plantings] = await Promise.all([
    prisma.submission.count({ where: { clientId } }),
    prisma.submission.count({ where: { clientId, closedAt: null } }),
    prisma.invoice.aggregate({
      where: { closedAt: { not: null }, submission: { clientId } },
      _sum: { billingWeight: true },
    }),
    prisma.treePlanting.findMany({
      where: { clientId },
      orderBy: { plantedAt: 'desc' },
    }),
  ]);

  const kg = Number(closedAgg._sum.billingWeight ?? 0);
  const tonnes = kg / 1000;
  const earned = treesEarned(tonnes);
  const byUrbeno = plantings.filter((p) => p.source !== 'client').reduce((s, p) => s + p.trees, 0);
  const planted = plantings.reduce((s, p) => s + p.trees, 0);

  return {
    ...client,
    stats: {
      requests: requestCount,
      open: openCount,
      tonnes,
      treesEarned: earned,
      treesPlanted: planted,
      treesOwed: Math.max(0, earned - byUrbeno),
    },
    plantings: plantings.map((p) => ({
      id: p.id,
      trees: p.trees,
      plantedAt: p.plantedAt.toISOString().slice(0, 10),
      location: p.location,
      note: p.note,
    })),
  };
}

export async function listFactoriesForMasters(includeInactive = false) {
  const factories = await prisma.factorySite.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: 'asc' },
    include: {
      categories: { where: { active: true }, select: { capacityTpa: true } },
      _count: { select: { mrns: true } },
    },
  });
  return factories.map((f) => ({
    id: f.id,
    name: f.name,
    address: f.address,
    gstin: f.gstin,
    kspcbConsent: f.kspcbConsent,
    cpcbEpr: f.cpcbEpr,
    managerEmail: f.managerEmail,
    active: f.active,
    approvedTpa: f.categories.reduce((s, c) => s + Number(c.capacityTpa), 0),
    categoryLines: f.categories.length,
    mrnCount: f._count.mrns,
  }));
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
    showPortalLogo?: boolean;
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
      showPortalLogo: input.showPortalLogo !== undefined ? input.showPortalLogo : undefined,
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
  input: {
    name?: string;
    address?: string;
    gstin?: string;
    city?: string;
    state?: string;
    pin?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    active?: boolean;
  },
) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new AppError('Site not found.');

  if (input.name !== undefined || input.address !== undefined || input.gstin !== undefined) {
    const name = (input.name ?? site.name).trim();
    const gstin = (input.gstin ?? site.gstin ?? '').trim().toUpperCase();
    const address = (input.address ?? site.address ?? '').trim();
    if (!name || !gstin || !address) {
      throw new AppError('Site name, GST and address are all required.');
    }
    const gstErr = gstinError(gstin);
    if (gstErr) throw new AppError(gstErr);
  }

  const updated = await prisma.site.update({
    where: { id: siteId },
    data: {
      name: input.name?.trim() || undefined,
      address: input.address !== undefined ? input.address.trim() || null : undefined,
      gstin: input.gstin !== undefined ? input.gstin.trim().toUpperCase() || null : undefined,
      city: input.city !== undefined ? input.city.trim() || null : undefined,
      state: input.state !== undefined ? input.state.trim() || null : undefined,
      pin: input.pin !== undefined ? input.pin.trim() || null : undefined,
      contactName: input.contactName !== undefined ? input.contactName.trim() || null : undefined,
      contactPhone: input.contactPhone !== undefined ? input.contactPhone.trim() || null : undefined,
      contactEmail: input.contactEmail !== undefined ? input.contactEmail.trim().toLowerCase() || null : undefined,
      active: input.active,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: input.active === false ? 'site.deactivate' : input.active === true ? 'site.activate' : 'site.update',
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
    featureAccess?: Record<string, boolean> | null;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AppError('User not found.');
  if (input.active === false && existing.id === actor.id) {
    throw new AppError('You cannot disable your own account.');
  }

  if (input.password && input.password !== 'demo') {
    await applyPassword(existing.id, existing.email, input.password);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim() || undefined,
      role: input.role,
      clientId: input.clientId === undefined ? undefined : input.clientId,
      factoryIds: input.factoryIds,
      siteIds: input.siteIds,
      active: input.active,
      featureAccess: input.featureAccess === undefined ? undefined : (input.featureAccess ?? Prisma.JsonNull),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      factoryIds: true,
      siteIds: true,
      active: true,
      featureAccess: true,
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
    managerEmail?: string | null;
    active?: boolean;
  },
) {
  const id = input.id.trim().toUpperCase();
  if (!input.name.trim()) throw new AppError('Facility name is required.');
  if (!input.address?.trim() && !(await prisma.factorySite.findUnique({ where: { id } }))) {
    throw new AppError('Facility name and address are required.');
  }
  const factory = await prisma.factorySite.upsert({
    where: { id },
    create: {
      id,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      gstin: input.gstin?.trim() || null,
      kspcbConsent: input.kspcbConsent?.trim() || null,
      cpcbEpr: input.cpcbEpr?.trim() || null,
      managerEmail: input.managerEmail?.trim().toLowerCase() || null,
      active: input.active ?? true,
    },
    update: {
      name: input.name.trim(),
      address: input.address !== undefined ? input.address.trim() || null : undefined,
      gstin: input.gstin !== undefined ? input.gstin.trim() || null : undefined,
      kspcbConsent: input.kspcbConsent !== undefined ? input.kspcbConsent.trim() || null : undefined,
      cpcbEpr: input.cpcbEpr !== undefined ? input.cpcbEpr.trim() || null : undefined,
      managerEmail: input.managerEmail !== undefined ? input.managerEmail?.trim().toLowerCase() || null : undefined,
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

export async function patchCategory(
  actor: SessionUser,
  id: number,
  input: {
    description?: string;
    groupCode?: string;
    capacityTpa?: number;
    activity?: string;
    authRef?: string;
    active?: boolean;
  },
) {
  const existing = await prisma.categoryMaster.findUnique({ where: { id } });
  if (!existing) throw new AppError('Category not found.', 404);

  const row = await prisma.categoryMaster.update({
    where: { id },
    data: {
      description: input.description?.trim() || undefined,
      groupCode: input.groupCode,
      capacityTpa: input.capacityTpa,
      activity: input.activity,
      authRef: input.authRef !== undefined ? input.authRef : undefined,
      active: input.active,
    },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'category.update',
    entity: 'category',
    entityId: `${row.factoryId}:${row.entryId}`,
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
