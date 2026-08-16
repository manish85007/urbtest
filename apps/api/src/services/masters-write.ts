import { UserRole } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import { hashPassword } from './auth.js';
import type { SessionUser } from '../lib/auth-context.js';

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
