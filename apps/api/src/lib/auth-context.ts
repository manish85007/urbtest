import type { User, UserRole } from '@prisma/client';
import { hasPermission, isStaffRole } from '@urb-tectrack/shared';
import { prisma } from './prisma.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  factoryIds: string[];
  siteIds: string[];
  featureAccess: Record<string, boolean> | null;
  /** Client portal branding (role === 'client' only). */
  clientName?: string | null;
  clientLogoFileId?: string | null;
  clientShowPortalLogo?: boolean;
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    factoryIds: user.factoryIds,
    siteIds: user.siteIds,
    featureAccess: (user.featureAccess as Record<string, boolean> | null) ?? null,
  };
}

/** Attach client logo / name for portal header when the user is a client. */
export async function enrichSessionUser(user: User): Promise<SessionUser> {
  const base = toSessionUser(user);
  if (user.role !== 'client' || !user.clientId) return base;
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, logoFileId: true, showPortalLogo: true },
  });
  if (!client) return base;
  return {
    ...base,
    clientName: client.name,
    clientLogoFileId: client.logoFileId,
    clientShowPortalLogo: client.showPortalLogo,
  };
}

/** Returns true if the user has a given feature flag explicitly enabled, or if no restrictions are set (null). */
export function hasFeature(user: SessionUser, feature: string): boolean {
  if (user.role === 'admin' || user.role === 'operations') return true;
  if (!user.featureAccess) return true;
  return user.featureAccess[feature] === true;
}

export function isStaff(user: SessionUser): boolean {
  return isStaffRole(user.role);
}

/** Empty factoryIds means every facility (kit: leave all unchecked). */
export function factoryInScope(user: SessionUser, factoryId: string): boolean {
  if (user.role === 'admin' || user.role === 'operations') return true;
  if (user.role !== 'factory') return false;
  if (!user.factoryIds.length) return true;
  return user.factoryIds.includes(factoryId);
}

export function canSeeMrn(user: SessionUser): boolean {
  return isStaff(user);
}

export function clientScopeFilter(user: SessionUser): Record<string, unknown> {
  if (user.role === 'admin' || user.role === 'factory' || user.role === 'operations') return {};
  return {
    clientId: user.clientId ?? '__none__',
    ...(user.siteIds.length
      ? { siteId: { in: user.siteIds } }
      : {}),
  };
}

export function can(user: SessionUser, permission: Parameters<typeof hasPermission>[1]): boolean {
  return hasPermission(user.role, permission);
}
