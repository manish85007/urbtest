import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';
import { COMPANY } from '../lib/company';

interface ProfilePageProps {
  user: SessionUser;
}

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: 'Urbeno Admin',
  factory: 'Factory Manager',
  client: 'Client User',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '--';
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

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
                  <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} />
                </div>
                <div className="fg">
                  <label>Confirm new password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={4} />
                </div>
              </div>
              {msg ? <p className="ok-msg">{msg}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn bp">
                Update password
              </button>
            </form>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-ttl">Support</div>
            <p className="dim" style={{ fontSize: '.85rem', margin: '.5rem 0' }}>
              For a consignment, raise a query on the request. For account access, ask your Urbeno contact.
            </p>
            <div style={{ fontSize: '.84rem', lineHeight: 1.7 }}>
              <div>
                📞{' '}
                <a href={`tel:${COMPANY.phoneTel}`} style={{ color: 'var(--g)' }}>
                  {COMPANY.phone}
                </a>
              </div>
              <div>
                ✉️{' '}
                <a href={`mailto:${COMPANY.email}`} style={{ color: 'var(--g)' }}>
                  {COMPANY.email}
                </a>
              </div>
              <div>
                💬{' '}
                <a href={COMPANY.waUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--g)' }}>
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
