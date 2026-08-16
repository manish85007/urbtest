import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, type SessionUser } from '../api';

interface ProfilePageProps {
  user: SessionUser;
}

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: 'Urbeno Admin',
  factory: 'Factory Manager',
  client: 'Client User',
};

export function ProfilePage({ user }: ProfilePageProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await authApi.changePassword(current, next);
      setMsg('Password updated.');
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    }
  }

  return (
    <div>
      <h1 className="h1">My profile</h1>

      <section className="card">
        <h2>Account</h2>
        <dl className="tile-list">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{ROLE_LABEL[user.role]}</dd>
          </div>
          {user.clientId ? (
            <div>
              <dt>Organisation</dt>
              <dd>{user.clientId}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card">
        <h2>Change password</h2>
        <form className="sub-form" onSubmit={changePassword}>
          <label>
            Current password
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} />
          </label>
          {msg ? <p className="ok-msg">{msg}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn primary">
            Update password
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Support</h2>
        <p className="muted">
          Urbeno operations: <a href="mailto:admin@urbeno.in">admin@urbeno.in</a>
        </p>
        <p className="muted">
          Policies: <Link to="/legal/terms">Terms</Link> · <Link to="/legal/privacy">Privacy</Link>
        </p>
      </section>
    </div>
  );
}
