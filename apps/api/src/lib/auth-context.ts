import type { User, UserRole } from '@prisma/client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  factoryIds: string[];
  siteIds: string[];
  featureAccess: Record<string, boolean> | null;
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

/** Returns true if the user has a given feature flag explicitly enabled, or if no restrictions are set (null). */
export function hasFeature(user: SessionUser, feature: string): boolean {
  if (user.role === 'admin') return true;
  if (!user.featureAccess) return true;
  return user.featureAccess[feature] === true;
}

export function isStaff(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'factory';
}

/** Empty factoryIds means every facility (kit: leave all unchecked). */
export function factoryInScope(user: SessionUser, factoryId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role !== 'factory') return false;
  if (!user.factoryIds.length) return true;
  return user.factoryIds.includes(factoryId);
}

export function canSeeMrn(user: SessionUser): boolean {
  return isStaff(user);
}

export function clientScopeFilter(user: SessionUser): Record<string, unknown> {
  if (user.role === 'admin' || user.role === 'factory') return {};
  return {
    clientId: user.clientId ?? '__none__',
    ...(user.siteIds.length
      ? { siteId: { in: user.siteIds } }
      : {}),
  };
}
