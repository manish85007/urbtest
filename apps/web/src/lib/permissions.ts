import type { SessionUser } from '../api';
import { isStaffRole, permissionsFor, type RolePermissionKey } from '@urb-tectrack/shared';

export function userPermissions(user: SessionUser) {
  return permissionsFor(user.role);
}

export function userCan(user: SessionUser, permission: RolePermissionKey): boolean {
  return permissionsFor(user.role)[permission];
}

export function isStaffUser(user: SessionUser): boolean {
  return isStaffRole(user.role);
}

export function isAdminUser(user: SessionUser): boolean {
  return user.role === 'admin';
}

export function isOperationsUser(user: SessionUser): boolean {
  return user.role === 'operations';
}

export function isFactoryUser(user: SessionUser): boolean {
  return user.role === 'factory';
}
