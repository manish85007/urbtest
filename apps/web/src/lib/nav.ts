import type { SessionUser } from '../api';

export interface NavItem {
  to: string;
  label: string;
  /** Compact glyph shown in the left sidebar */
  icon: string;
  match?: (path: string) => boolean;
  /** Optional section heading above this item */
  section?: string;
}

export function navItems(role: SessionUser['role']): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/', label: 'Dashboard', icon: '⌂', section: 'Overview', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
      { to: '/heroes', label: 'Recycling Heroes', icon: '🌳', section: 'Impact' },
      { to: '/impact', label: 'Sustainability', icon: '◎' },
      { to: '/capacity', label: 'Capacity', icon: '▤' },
      { to: '/reports', label: 'Reports', icon: '▦', section: 'Records' },
      { to: '/masters', label: 'Masters', icon: '⚙' },
      { to: '/audit', label: 'Audit', icon: '⌖' },
      { to: '/compliance', label: 'Compliance', icon: '✓' },
    ];
  }
  if (role === 'operations') {
    return [
      { to: '/', label: 'Dashboard', icon: '⌂', section: 'Overview', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
      { to: '/heroes', label: 'Recycling Heroes', icon: '🌳', section: 'Impact' },
      { to: '/impact', label: 'Sustainability', icon: '◎' },
      { to: '/capacity', label: 'Capacity', icon: '▤' },
      { to: '/reports', label: 'Reports', icon: '▦', section: 'Records' },
    ];
  }
  if (role === 'factory') {
    return [
      { to: '/', label: 'Dashboard', icon: '⌂', section: 'Overview', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
      { to: '/capacity', label: 'Capacity', icon: '▤', section: 'Operations' },
      { to: '/reports', label: 'Reports', icon: '▦' },
    ];
  }
  if (role === 'auditor') {
    return [
      { to: '/', label: 'Dashboard', icon: '⌂', section: 'Overview', match: (p) => p === '/' },
      { to: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
      { to: '/heroes', label: 'Recycling Heroes', icon: '🌳', section: 'Impact' },
      { to: '/impact', label: 'Sustainability', icon: '◎' },
      { to: '/reports', label: 'Reports', icon: '▦', section: 'Records' },
      { to: '/audit', label: 'Audit', icon: '⌖' },
      { to: '/compliance', label: 'Compliance', icon: '✓' },
    ];
  }
  return [
    { to: '/', label: 'Home', icon: '⌂', section: 'Overview', match: (p) => p === '/' },
    { to: '/requests', label: 'My Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
    { to: '/heroes', label: 'Recycling Heroes', icon: '🌳', section: 'Impact' },
    { to: '/impact', label: 'Sustainability', icon: '◎' },
    { to: '/reports', label: 'Reports', icon: '▦', section: 'Records' },
  ];
}
