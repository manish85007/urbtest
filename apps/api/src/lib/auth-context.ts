import type { User, UserRole } from '@prisma/client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  factoryIds: string[];
  siteIds: string[];
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
  };
}

export function isStaff(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'factory';
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
