import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';

interface ShellProps {
  user: SessionUser;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ user, onLogout, children }: ShellProps) {
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
          <Link to="/" className="on">
            Dashboard
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
