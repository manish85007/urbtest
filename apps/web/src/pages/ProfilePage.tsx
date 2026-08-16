import { Link } from 'react-router-dom';
import type { SessionUser } from '../api';

interface ProfilePageProps {
  user: SessionUser;
}

const ROLE_LABEL: Record<SessionUser['role'], string> = {
  admin: 'Urbeno Admin',
  factory: 'Factory Manager',
  client: 'Client User',
};

export function ProfilePage({ user }: ProfilePageProps) {
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
        <h2>Session</h2>
        <p className="muted">Signed in with HttpOnly session cookie (8-hour idle timeout).</p>
      </section>

      <section className="card">
        <h2>Support</h2>
        <p className="muted">
          Urbeno operations: <a href="mailto:admin@urbeno.in">admin@urbeno.in</a> ·{' '}
          <a href="tel:+919845010001">+91 98450 10001</a>
        </p>
        <p className="muted">
          Policies: <Link to="/legal/terms">Terms</Link> · <Link to="/legal/privacy">Privacy</Link>
        </p>
      </section>
    </div>
  );
}
