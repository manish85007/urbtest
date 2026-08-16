import { useState } from 'react';
import { authApi, type SessionUser } from '../api';
import { LogoPrimary } from '../components/BrandMark';

interface LoginPageProps {
  onLogin: (user: SessionUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('admin@urbeno.in');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);

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
    <div id="login" className="login">
      <div className="lbox">
        <div className="lbrand">
          <div style={{ marginBottom: '.9rem' }}>
            <LogoPrimary />
          </div>
          <div className="lbrand-n">
            Urb TecTrack<span style={{ fontSize: '.6em', verticalAlign: 'super' }}>™</span>
          </div>
          <div className="lbrand-s">E-waste management platform</div>
        </div>

        {reset ? (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--g2)', marginBottom: '.5rem' }}>Reset your password</div>
            <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.7rem' }}>
              Password reset by email is not enabled in this environment. Ask an Urbeno admin to set a
              temporary password, then change it from Profile after you sign in.
            </p>
            <div className="forgot">
              <a onClick={() => setReset(false)}>← Back to sign in</a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="fg">
              <label htmlFor="li-em">Email</label>
              <input
                id="li-em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
              />
            </div>
            <div className="fg">
              <label htmlFor="li-pw">Password</label>
              <input
                id="li-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
              />
            </div>
            {error ? (
              <div style={{ color: 'var(--rd)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</div>
            ) : null}
            <button className="btn bp" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="forgot">
              <a onClick={() => setReset(true)}>Forgot password?</a>
            </div>
          </form>
        )}

        <div className="demo-logins">
          <b>Demo logins</b> (password: <span className="mono">demo</span>)
          <br />
          admin@urbeno.in — Urbeno admin
          <br />
          kgf@urbeno.in — Factory manager (KGF)
          <br />
          ramesh@techcorp.in — Client (all sites)
        </div>
      </div>
    </div>
  );
}
