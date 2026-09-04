import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi, filesApi, announcementsApi, type SessionUser, type AnnouncementRow } from '../api';
import { navItems } from '../lib/nav';
import { isClientPortalRole } from '@urb-tectrack/shared';
import { portalSubtitle } from '../lib/roles';
import { LogoIcon } from './BrandMark';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { COMPANY } from '../lib/company';

const NARROW_MQ = '(max-width: 820px)';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ShellProps {
  user: SessionUser;
  onLogout: () => void;
  children: ReactNode;
  /** When set, show a staff MFA grace reminder in the header strip. */
  mfaGraceDaysLeft?: number | null;
}

function brandSub(user: SessionUser) {
  if (isClientPortalRole(user.role) && user.clientName) return user.clientName;
  return portalSubtitle(user.role, user.factoryIds ?? []);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '--';
}

export function Shell({ user, onLogout, children, mfaGraceDaysLeft = null }: ShellProps) {
  const loc = useLocation();
  const items = navItems(user.role);
  const [navOpen, setNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_MQ).matches,
  );
  const sideRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const showClientLogo =
    isClientPortalRole(user.role) && user.clientShowPortalLogo && !!user.clientLogoFileId;

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNavCollapsed(window.localStorage.getItem('shell-nav-collapsed') === 'true');
  }, []);

  // Close mobile drawer on route change or when resizing to desktop
  useEffect(() => {
    setNavOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!isNarrow) setNavOpen(false);
  }, [isNarrow]);

  useEffect(() => {
    if (typeof window === 'undefined' || isNarrow) return;
    window.localStorage.setItem('shell-nav-collapsed', String(navCollapsed));
  }, [isNarrow, navCollapsed]);

  // Poll active announcements every 5 minutes
  useEffect(() => {
    const load = () => announcementsApi.active().then(setAnnouncements).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Keep closed mobile drawer out of the a11y / tab tree
  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    const sideInert = isNarrow && !navOpen;
    if (sideInert) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
    el.toggleAttribute('aria-hidden', sideInert);
  }, [isNarrow, navOpen]);

  // Scroll lock, Escape, focus trap while mobile drawer is open
  useEffect(() => {
    if (!navOpen || !isNarrow) return;

    const aside = sideRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      aside
        ? Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
          )
        : [];

    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !aside) return;
      const list = focusables();
      if (list.length === 0) return;
      const head = list[0]!;
      const tail = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      burgerRef.current?.focus();
    };
  }, [navOpen, isNarrow]);

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

  const activeLabel = items.find((i) => isActive(i))?.label ?? 'Urb TecTrack';

  return (
    <div className={`app app-shell ${navOpen ? 'nav-open' : ''} ${navCollapsed && !isNarrow ? 'nav-collapsed' : ''}`}>
      {navOpen ? (
        <button
          type="button"
          className="side-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside ref={sideRef} id="shell-side-nav" className="side" aria-label="Main navigation">
        <div className="side-head">
          <Link to="/" className="side-brand" onClick={() => setNavOpen(false)} title={navCollapsed && !isNarrow ? 'Urb TecTrack' : undefined}>
            <div className="brand-i">
              {showClientLogo ? (
                <img
                  src={filesApi.url(user.clientLogoFileId!, { stream: true })}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }}
                />
              ) : (
                <LogoIcon />
              )}
            </div>
            <div className="side-brand-txt">
              <div className="brand-t">
                Urb TecTrack<span style={{ fontSize: '.62em', verticalAlign: 'super' }}>™</span>
              </div>
              <div className="brand-s">{brandSub(user)}</div>
            </div>
          </Link>
          {!isNarrow ? (
            <button
              type="button"
              className="side-toggle"
              aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={navCollapsed}
              onClick={() => setNavCollapsed((v) => !v)}
              title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {navCollapsed ? '»' : '«'}
            </button>
          ) : null}
        </div>

        <nav className="side-nav">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <div key={item.to} className="side-nav-block">
                {item.section ? <div className="side-sec">{item.section}</div> : null}
                <Link
                  to={item.to}
                  className={active ? 'on' : ''}
                  aria-current={active ? 'page' : undefined}
                  aria-label={navCollapsed && !isNarrow ? item.label : undefined}
                  title={navCollapsed && !isNarrow ? item.label : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="side-ic" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="side-lb">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="side-foot">
          <Link
            to="/profile"
            className="side-profile"
            aria-label={navCollapsed && !isNarrow ? 'Profile' : undefined}
            title={navCollapsed && !isNarrow ? `${user.name} · ${brandSub(user)}` : undefined}
            onClick={() => setNavOpen(false)}
          >
            <div className="uav">{initials(user.name)}</div>
            <div className="side-profile-txt">
              <div className="side-profile-n">{user.name.split(' ')[0]}</div>
              <div className="side-profile-r">{brandSub(user)}</div>
            </div>
          </Link>
        </div>
      </aside>

      <div className="shell-main">
        {mfaGraceDaysLeft != null && mfaGraceDaysLeft > 0 ? (
          <div
            className="ann-bar"
            role="status"
            style={{ background: 'var(--am, #8a5a00)', color: '#fff' }}
          >
            <div className="ann-bar-inner" style={{ animation: 'none', justifyContent: 'center' }}>
              <span className="ann-bar-item">
                Two-factor authentication is required for your role. Enrol within {mfaGraceDaysLeft}{' '}
                day{mfaGraceDaysLeft === 1 ? '' : 's'} —{' '}
                <Link to="/profile" style={{ color: '#fff', textDecoration: 'underline' }}>
                  set up now
                </Link>
                .
              </span>
            </div>
          </div>
        ) : null}
        {announcements.length > 0 && (
          <div className="ann-bar" role="marquee" aria-label="Announcements">
            <div className="ann-bar-inner">
              {[...announcements, ...announcements].map((a, i) => (
                <span key={`${a.id}-${i}`} className="ann-bar-item">{a.message}</span>
              ))}
            </div>
          </div>
        )}
        <header className="top">
          <div className="top-in">
            <button
              ref={burgerRef}
              type="button"
              className="burger"
              aria-label="Menu"
              aria-expanded={navOpen}
              aria-controls="shell-side-nav"
              onClick={() => setNavOpen((v) => !v)}
            >
              ☰
            </button>
            <div className="top-title desktop-hide-sm">{activeLabel}</div>
            <GlobalSearch />
            <div className="spacer" />
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

        <footer className="foot">
          <div className="foot-in">
            <div className="foot-l">
              <b>Urb TecTrack™</b> · Urbeno Private Limited · Recycling Heroes™
              <br />
              <span className="dim">
                CPCB registered · KSPCB authorised ·{' '}
                <a href={COMPANY.complianceUrl} target="_blank" rel="noopener noreferrer">
                  ISO 9001:2015 · ISO 14001:2015 · ISO 45001:2018 · ISO/IEC 27001:2022
                </a>
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
    </div>
  );
}
