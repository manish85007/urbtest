import type { SessionUser } from '../api';

/** User-facing role labels — internal role slug stays `admin`. */
export function roleLabel(role: SessionUser['role'] | string): string {
  switch (role) {
    case 'admin':
      return 'Super Admin';
    case 'operations':
      return 'Operations Manager';
    case 'factory':
      return 'Factory Manager';
    case 'client':
      return 'Client User';
    case 'client_readonly':
      return 'Client Read Only';
    case 'auditor':
      return 'Auditor';
    default:
      return role;
  }
}

export function portalSubtitle(role: SessionUser['role'], factoryIds: string[] = []): string {
  if (role === 'client' || role === 'client_readonly') return 'Client portal';
  if (role === 'operations') return 'Urbeno · Operations';
  if (role === 'factory') {
    return factoryIds.length ? `Urbeno · ${factoryIds.join(', ')}` : 'Urbeno · All facilities';
  }
  if (role === 'auditor') return 'Urbeno · Auditor (read-only)';
  return 'Urbeno · Super Admin';
}

export function dashboardTitle(role: SessionUser['role']): string {
  if (role === 'operations') return 'Operations Dashboard';
  if (role === 'factory') return 'Factory Dashboard';
  if (role === 'admin') return 'Super Admin Dashboard';
  if (role === 'auditor') return 'Auditor Dashboard';
  if (role === 'client_readonly') return 'Client Portal (View Only)';
  return 'Your Dashboard';
}
