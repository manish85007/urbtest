import type { SessionUser } from '../api';

export interface NavItem {
  to: string;
  label: string;
  match?: (path: string) => boolean;
}

export function navItems(role: SessionUser['role']): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/', label: 'Dashboard', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', match: (p) => p.startsWith('/requests') },
      { to: '/heroes', label: 'Recycle Heroes' },
      { to: '/capacity', label: 'Capacity' },
      { to: '/masters', label: 'Masters' },
      { to: '/reports', label: 'Reports' },
      { to: '/audit', label: 'Audit' },
      { to: '/compliance', label: 'Compliance' },
    ];
  }
  if (role === 'factory') {
    return [
      { to: '/', label: 'Dashboard', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', match: (p) => p.startsWith('/requests') },
      { to: '/capacity', label: 'Capacity' },
      { to: '/reports', label: 'Reports' },
    ];
  }
  return [
    { to: '/', label: 'Home', match: (p) => p === '/' },
    { to: '/requests', label: 'My Requests', match: (p) => p.startsWith('/requests') },
    { to: '/heroes', label: 'Recycle Heroes' },
    { to: '/impact', label: 'Sustainability' },
    { to: '/reports', label: 'Reports' },
  ];
}
