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
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [info, setInfo] = useState('');

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

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await authApi.requestReset(email);
      setDemoCode(r.demoCode ?? null);
      setResetStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function setPasswordFromCode(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== newPw2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.confirmReset(email, code, newPw);
      setReset(false);
      setResetStep('email');
      setPassword('');
      setInfo('Password updated — sign in with your new password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
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
          resetStep === 'email' ? (
            <form onSubmit={sendCode}>
              <div style={{ fontWeight: 700, color: 'var(--g2)', marginBottom: '.5rem' }}>Reset your password</div>
              <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.7rem' }}>
                Enter your email and we&apos;ll send a 6-digit code, valid for 15 minutes.
              </p>
              <div className="fg">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {error ? <div style={{ color: 'var(--rd)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</div> : null}
              <button className="btn bp" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={busy}>
                Send Code
              </button>
              <div className="forgot">
                <a onClick={() => setReset(false)}>← Back to sign in</a>
              </div>
            </form>
          ) : (
            <form onSubmit={setPasswordFromCode}>
              <div style={{ fontWeight: 700, color: 'var(--g2)', marginBottom: '.5rem' }}>Enter the code</div>
              <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.5rem' }}>
                If an account exists for <b>{email}</b>, a 6-digit code is on its way. It expires in 15 minutes.
              </p>
              {demoCode ? (
                <div
                  style={{
                    background: 'var(--am2)',
                    color: 'var(--am)',
                    padding: '.45rem .7rem',
                    borderRadius: 7,
                    fontSize: '.78rem',
                    marginBottom: '.6rem',
                  }}
                >
                  <b>Prototype only:</b> the code is{' '}
                  <span className="mono" style={{ fontSize: '1rem', fontWeight: 800 }}>
                    {demoCode}
                  </span>{' '}
                  — in production this appears only in the email.
                </div>
              ) : null}
              <div className="fg">
                <label>6-digit code</label>
                <input
                  className="mono"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  style={{ fontSize: '1.1rem', letterSpacing: '.2em', textAlign: 'center' }}
                  required
                />
              </div>
              <div className="fg">
                <label>New password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
              </div>
              <div className="fg">
                <label>Confirm new password</label>
                <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required />
              </div>
              {error ? <div style={{ color: 'var(--rd)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</div> : null}
              <button className="btn bp" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={busy}>
                Set New Password
              </button>
              <div className="forgot">
                <a
                  onClick={() => {
                    setReset(false);
                    setResetStep('email');
                  }}
                >
                  ← Back to sign in
                </a>
              </div>
            </form>
          )
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
            {info ? <div style={{ color: 'var(--g2)', fontSize: '.8rem', marginBottom: '.5rem' }}>{info}</div> : null}
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
