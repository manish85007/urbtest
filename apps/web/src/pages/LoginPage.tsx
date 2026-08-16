import { useState } from 'react';
import { authApi, type SessionUser } from '../api';

interface LoginPageProps {
  onLogin: (user: SessionUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('admin@urbeno.in');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await authApi.login(email, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-box" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-icon lg">U</div>
          <h1>Urb TecTrack™</h1>
          <p>Urbeno E-Waste Management Platform</p>
        </div>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hint">Demo: admin@urbeno.in / demo</p>
      </form>
    </div>
  );
}
