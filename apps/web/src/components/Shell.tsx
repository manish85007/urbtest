import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';

interface ShellProps {
  user: SessionUser;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ user, onLogout, children }: ShellProps) {
  const loc = useLocation();

  async function logout() {
    await authApi.logout();
    onLogout();
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
          <Link to="/" className={loc.pathname === '/' ? 'on' : ''}>
            Dashboard
          </Link>
          <Link to="/requests/new" className={loc.pathname === '/requests/new' ? 'on' : ''}>
            New request
          </Link>
        </nav>
        <div className="user-chip">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <span>{user.name}</span>
          <button type="button" className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </div>
  );
}
