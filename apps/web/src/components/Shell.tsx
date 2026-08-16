import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';
import { navItems } from '../lib/nav';

interface ShellProps {
  user: SessionUser;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ user, onLogout, children }: ShellProps) {
  const loc = useLocation();
  const items = navItems(user.role);

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      onLogout();
    }
  }

  function isActive(item: (typeof items)[number]) {
    if (item.match) return item.match(loc.pathname);
    return loc.pathname === item.to || loc.pathname.startsWith(`${item.to}/`);
  }

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="brand">
          <div className="brand-icon">U</div>
          <div>
            <div className="brand-title">Urb TecTrack™</div>
            <div className="brand-sub">Recycling Heroes™</div>
          </div>
        </Link>
        <nav className="nav">
          {items.map((item) => (
            <Link key={item.to} to={item.to} className={isActive(item) ? 'on' : ''}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="user-chip">
          <Link to="/profile" className="avatar-link" title="My profile">
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <span>{user.name}</span>
          </Link>
          <button type="button" className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="footer">
        <Link to="/legal/terms">Terms</Link>
        <Link to="/legal/privacy">Privacy &amp; Data</Link>
        <Link to="/legal/compliance">Compliance</Link>
      </footer>
    </div>
  );
}
