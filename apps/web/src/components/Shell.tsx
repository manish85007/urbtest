import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';
import { navItems } from '../lib/nav';
import { portalSubtitle } from '../lib/roles';
import { LogoIcon } from './BrandMark';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { COMPANY } from '../lib/company';

interface ShellProps {
  user: SessionUser;
  onLogout: () => void;
  children: ReactNode;
}

function brandSub(user: SessionUser) {
  return portalSubtitle(user.role, user.factoryIds ?? []);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '--';
}

export function Shell({ user, onLogout, children }: ShellProps) {
  const loc = useLocation();
  const items = navItems(user.role);
  const [navOpen, setNavOpen] = useState(false);

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
        <div className="top-in">
          <button type="button" className="burger" aria-label="Menu" onClick={() => setNavOpen((v) => !v)}>
            ☰
          </button>
          <Link to="/" className="brand" onClick={() => setNavOpen(false)}>
            <div className="brand-i">
              <LogoIcon />
            </div>
            <div>
              <div className="brand-t">
                Urb TecTrack<span style={{ fontSize: '.62em', verticalAlign: 'super' }}>™</span>
              </div>
              <div className="brand-s">{brandSub(user)}</div>
            </div>
          </Link>
          <GlobalSearch />
          <div className="spacer" />
          <nav className={`nav ${navOpen ? 'open' : ''}`}>
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={isActive(item) ? 'on' : ''}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <NotificationBell />
          <Link
            to="/profile"
            className={`uchip ${loc.pathname === '/profile' ? 'on' : ''}`}
            title="Your profile and password"
          >
            <div className="uav">{initials(user.name)}</div>
            <span>{user.name.split(' ')[0]}</span>
          </Link>
          <button type="button" className="btn bs bsm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="wrap">{children}</main>
      {user.role === 'client' ? (
        <a className="wa-fab" href={COMPANY.waUrl} target="_blank" rel="noopener noreferrer">
          💬 WhatsApp
        </a>
      ) : null}
      <footer className="foot">
        <div className="foot-in">
          <div className="foot-l">
            <b>Urb TecTrack™</b> · Urbeno Private Limited · Recycling Heroes™
            <br />
            <span className="dim">
              R2v3 certified · CPCB registered · KSPCB authorised · ISO 9001:2015 &amp; ISO 14001:2015
            </span>
          </div>
          <div className="foot-r">
            <a href={COMPANY.waUrl} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <Link to="/legal/terms">Terms of Use</Link>
            <Link to="/legal/privacy">Privacy &amp; Data</Link>
            <Link to="/legal/compliance">Compliance Notice</Link>
            <Link to="/legal/support">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
