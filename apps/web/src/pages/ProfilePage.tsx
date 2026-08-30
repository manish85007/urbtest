import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, dataApi, filesApi, type CompanyProfile, type SessionUser } from '../api';
import { COMPANY } from '../lib/company';
import { roleLabel } from '../lib/roles';

interface ProfilePageProps {
  user: SessionUser;
}

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: roleLabel('admin'),
  operations: roleLabel('operations'),
  factory: roleLabel('factory'),
  client: roleLabel('client'),
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '--';
}

function phoneTel(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    dataApi.company().then(setCompany).catch(() => setCompany(null));
  }, []);

  const support = company ?? {
    name: COMPANY.name,
    brand: COMPANY.brand,
    address: '',
    gst: '',
    cin: '',
    phone: COMPANY.phone,
    email: COMPANY.email,
    wa: COMPANY.wa,
    cpcb: '',
    kspcb: '',
    r2: '',
    logoFileId: null,
  };

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    if (next !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await authApi.changePassword(current, next);
      setMsg('Password updated — use it the next time you sign in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    }
  }

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div className="h1">Your profile</div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="uav" style={{ width: 42, height: 42, fontSize: '.9rem' }}>
                {initials(user.name)}
              </div>
              <div>
                <div className="card-ttl">{user.name}</div>
                <div className="dim" style={{ fontSize: '.8rem' }}>
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '.45rem' }}>
              <div className="tile">
                <div className="tile-l">Email</div>
                <div className="tile-v">{user.email}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Role</div>
                <div className="tile-v">{ROLE_LABEL[user.role]}</div>
              </div>
              {user.clientId ? (
                <div className="tile">
                  <div className="tile-l">Organisation</div>
                  <div className="tile-v">{user.clientId}</div>
                </div>
              ) : null}
              {(user.factoryIds ?? []).length ? (
                <div className="tile">
                  <div className="tile-l">Facilities</div>
                  <div className="tile-v">{user.factoryIds?.join(', ')}</div>
                </div>
              ) : null}
            </div>
          </div>

          {user.role === 'admin' || user.role === 'factory' ? (
            <div className="card">
              <div className="card-ttl">Two-factor authentication</div>
              <MfaCard />
            </div>
          ) : null}

          <div className="card">
            <div className="card-ttl">Change password</div>
            <form className="sub-form" onSubmit={changePassword} style={{ marginTop: '.6rem', paddingTop: 0, border: 'none' }}>
              <div className="fg">
                <label>Current password</label>
                <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
              <div className="fr2">
                <div className="fg">
                  <label>New password</label>
                  <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
                </div>
                <div className="fg">
                  <label>Confirm new password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} />
                </div>
              </div>
              <p className="dim" style={{ fontSize: '.78rem' }}>
                10 characters or more, an upper-case letter, a lower-case letter, a digit. It cannot repeat your last 5
                passwords.
              </p>
              {msg ? <p className="ok-msg">{msg}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn bp">
                Update password
              </button>
            </form>
          </div>

          {user.role === 'admin' ? (
            <div className="card">
              <div className="card-ttl">Urbeno letterhead</div>
              <p className="dim" style={{ fontSize: '.84rem', margin: '.4rem 0 .7rem' }}>
                Statutory company details (GSTIN, PAN, CIN, CPCB / State PCB, logo) are maintained in{' '}
                <Link to="/masters?tab=company">Masters → Company &amp; Letterhead</Link>. Values are stored in the
                backend and print on Form 6 / MRN.
              </p>
              {company ? (
                <div style={{ fontSize: '.84rem', lineHeight: 1.7 }}>
                  <div>
                    <b>{company.name}</b>
                  </div>
                  <div className="dim">{company.address}</div>
                  <div>GST {company.gst}</div>
                  {company.pan ? <div>PAN {company.pan}</div> : null}
                  <div>CIN {company.cin}</div>
                  {company.cpcb ? <div>CPCB {company.cpcb}</div> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div>
          <div className="card">
            <div className="card-ttl">{support.name}</div>
            {support.logoFileId ? (
              <img
                className="logo-preview"
                src={filesApi.url(support.logoFileId)}
                alt={`${support.name} logo`}
                style={{ maxHeight: 56, margin: '.4rem 0 .6rem' }}
              />
            ) : null}
            <p className="dim" style={{ fontSize: '.85rem', margin: '.5rem 0' }}>
              {support.address || 'Letterhead address is set by Urbeno admin on this page.'}
            </p>
            <div style={{ fontSize: '.84rem', lineHeight: 1.7 }}>
              {support.gst ? <div>GST {support.gst}</div> : null}
              {support.cin ? <div>CIN {support.cin}</div> : null}
              <div>
                📞{' '}
                <a href={`tel:${phoneTel(support.phone)}`} style={{ color: 'var(--g)' }}>
                  {support.phone}
                </a>
              </div>
              <div>
                ✉️{' '}
                <a href={`mailto:${support.email}`} style={{ color: 'var(--g)' }}>
                  {support.email}
                </a>
              </div>
              <div>
                💬{' '}
                <a
                  href={`https://wa.me/${support.wa || COMPANY.wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--g)' }}
                >
                  WhatsApp support
                </a>
              </div>
            </div>
            <div style={{ marginTop: '.8rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Link to="/legal/terms">Terms of Use</Link>
              <Link to="/legal/privacy">Privacy &amp; Data</Link>
              <Link to="/legal/support">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MfaCard() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof authApi.mfaStatus>> | null>(null);
  const [enrol, setEnrol] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setStatus(await authApi.mfaStatus());
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  function formatSecret(s: string) {
    return s.replace(/(.{4})/g, '$1 ').trim();
  }

  async function copySecret() {
    if (!enrol) return;
    try {
      await navigator.clipboard.writeText(enrol.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the key and copy manually.');
    }
  }

  return (
    <div style={{ marginTop: '.5rem' }}>
      {status?.required ? <span className="badge bg-am">Required for your role</span> : null}
      <p className="dim" style={{ fontSize: '.84rem', margin: '.4rem 0' }}>
        {status?.enrolled
          ? `Enrolled${status.enrolledAt ? ` on ${status.enrolledAt.slice(0, 10)}` : ''}. Codes come from an authenticator app (TOTP) — not SMS or email.`
          : 'Not enrolled. Super Admins and factory managers should set this up with an authenticator app (Google Authenticator, Microsoft Authenticator, etc.).'}
      </p>
      {status?.passwordExpired ? (
        <p className="error">Your password is past the rotation period.</p>
      ) : status?.passwordAgeDays != null ? (
        <p className="dim">Password age: {status.passwordAgeDays} days.</p>
      ) : null}
      {enrol ? (
        <div>
          <p className="dim" style={{ marginBottom: '.5rem' }}>
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '.6rem',
              background: '#fff',
              border: '1px solid var(--bd)',
              borderRadius: 10,
              marginBottom: '.6rem',
            }}
          >
            <img
              src={enrol.qrDataUrl}
              alt="QR code to enrol authenticator app"
              width={240}
              height={240}
              style={{ display: 'block' }}
            />
          </div>
          <details style={{ marginBottom: '.7rem' }} open={showSecret} onToggle={(e) => setShowSecret((e.target as HTMLDetailsElement).open)}>
            <summary style={{ cursor: 'pointer', fontSize: '.84rem', color: 'var(--g2)' }}>
              Can&apos;t scan? Enter the key manually
            </summary>
            <p className="dim" style={{ fontSize: '.78rem', margin: '.35rem 0' }}>
              Add an account in your app → enter this key (spaces optional):
            </p>
            <div
              className="mono"
              style={{
                fontWeight: 700,
                fontSize: '.9rem',
                letterSpacing: '.06em',
                wordBreak: 'break-all',
                padding: '.5rem .65rem',
                background: 'var(--bg)',
                border: '1px solid var(--bd)',
                borderRadius: 7,
                marginBottom: '.4rem',
              }}
            >
              {formatSecret(enrol.secret)}
            </div>
            <button type="button" className="btn bs bsm" onClick={() => void copySecret()}>
              {copied ? 'Copied' : 'Copy key'}
            </button>
          </details>
          <div className="fg" style={{ marginBottom: '.5rem' }}>
            <label htmlFor="mfa-confirm">Authenticator code</label>
            <input
              id="mfa-confirm"
              className="mono"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={{ fontSize: '1.1rem', letterSpacing: '.2em', textAlign: 'center', maxWidth: 160 }}
              autoComplete="one-time-code"
            />
          </div>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn bp bsm"
              disabled={code.length !== 6}
              onClick={() =>
                authApi
                  .mfaConfirm(enrol.secret, code)
                  .then(() => {
                    setEnrol(null);
                    setCode('');
                    setShowSecret(false);
                    setMsg('✓ Two-factor enabled');
                    return load();
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
              }
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn bs bsm"
              onClick={() => {
                setEnrol(null);
                setCode('');
                setShowSecret(false);
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : status?.enrolled ? (
        <div>
          <input placeholder="Reason for removal" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button
            type="button"
            className="btn bs bsm"
            onClick={() =>
              authApi
                .mfaDisable(reason)
                .then(() => {
                  setMsg('Second factor removed');
                  return load();
                })
                .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn bp bsm"
          onClick={() =>
            authApi
              .mfaStart()
              .then((r) => {
                setMsg('');
                setError('');
                setEnrol({ secret: r.secret, qrDataUrl: r.qrDataUrl });
              })
              .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
          }
        >
          Set up two-factor
        </button>
      )}
      {msg ? <p className="ok-msg">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
