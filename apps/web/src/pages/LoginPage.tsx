import { useCallback, useState } from 'react';
import { authApi, type SessionUser } from '../api';
import { LogoPrimary } from '../components/BrandMark';
import { LoginCaptcha, type CaptchaPayload } from '../components/LoginCaptcha';

interface LoginPageProps {
  onLogin: (user: SessionUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [info, setInfo] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needMfa, setNeedMfa] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'email' | null>(null);
  const [mfaDemo, setMfaDemo] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState('');
  const [needEmailOtp, setNeedEmailOtp] = useState(false);
  const [emailOtpDemo, setEmailOtpDemo] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaPayload | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  const onCaptchaChange = useCallback((payload: CaptchaPayload | null, ready: boolean) => {
    setCaptcha(payload);
    setCaptchaReady(ready);
  }, []);

  function refreshCaptcha() {
    setCaptchaKey((k) => k + 1);
    setCaptcha(null);
    setCaptchaReady(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const continuing = needMfa || needEmailOtp;
    if (!continuing && !captchaReady) {
      setError('Complete the security check before signing in.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { user } = await authApi.login(
        email,
        password,
        needMfa ? mfaCode : undefined,
        needEmailOtp ? emailOtp : undefined,
        continuing ? undefined : captcha ?? undefined,
      );
      onLogin(user);
    } catch (err) {
      const e = err as Error & {
        mfaRequired?: boolean;
        mfaMethod?: 'totp' | 'email' | null;
        emailOtpRequired?: boolean;
        demoCode?: string | null;
      };
      setError(e.message || 'Sign in failed');
      if (!needMfa && !needEmailOtp) refreshCaptcha();
      if (e.mfaRequired || /six-digit|authenticator|emailed you/i.test(e.message)) {
        setNeedMfa(true);
        if (e.mfaMethod === 'email' || /emailed you/i.test(e.message)) {
          setMfaMethod('email');
          if (e.demoCode) setMfaDemo(e.demoCode);
        } else {
          setMfaMethod(e.mfaMethod === 'totp' ? 'totp' : 'totp');
        }
      }
      if (e.emailOtpRequired || /emailed you|email verification|90 days/i.test(e.message)) {
        if (!e.mfaRequired) {
          setNeedEmailOtp(true);
          if (e.demoCode) setEmailOtpDemo(e.demoCode);
        } else if (e.mfaMethod !== 'email') {
          setNeedEmailOtp(true);
          if (e.demoCode) setEmailOtpDemo(e.demoCode);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaReady) {
      setError('Complete the security check before continuing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await authApi.requestReset(email, captcha ?? undefined);
      setDemoCode(r.demoCode ?? null);
      setResetStep('code');
      refreshCaptcha();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
      refreshCaptcha();
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
      refreshCaptcha();
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
                Enter your email and we&apos;ll send a 6-digit OTP to that address. The code is valid for 15 minutes.
              </p>
              <div className="fg">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <LoginCaptcha refreshKey={captchaKey} onChange={onCaptchaChange} />
              {error ? <div style={{ color: 'var(--rd)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</div> : null}
              <button
                className="btn bp"
                style={{ width: '100%', justifyContent: 'center' }}
                type="submit"
                disabled={busy || !captchaReady}
              >
                Send email OTP
              </button>
              <div className="forgot">
                <a
                  onClick={() => {
                    setReset(false);
                    refreshCaptcha();
                  }}
                >
                  ← Back to sign in
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={setPasswordFromCode}>
              <div style={{ fontWeight: 700, color: 'var(--g2)', marginBottom: '.5rem' }}>Enter the code</div>
              <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.5rem' }}>
                If an account exists for <b>{email}</b>, a 6-digit email OTP is on its way. It expires in 15 minutes.
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
                <label>6-digit email OTP</label>
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
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={10} />
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
                    refreshCaptcha();
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
            {!needMfa && !needEmailOtp ? (
              <LoginCaptcha refreshKey={captchaKey} onChange={onCaptchaChange} />
            ) : null}
            {needMfa ? (
              <div className="fg">
                <label htmlFor="li-mfa">
                  {mfaMethod === 'email' ? 'Email two-factor code' : 'Authenticator app code'}
                </label>
                {mfaMethod === 'email' && mfaDemo ? (
                  <div
                    style={{
                      background: 'var(--am2)',
                      color: 'var(--am)',
                      padding: '.45rem .7rem',
                      borderRadius: 7,
                      fontSize: '.78rem',
                      marginBottom: '.45rem',
                    }}
                  >
                    <b>Demo:</b>{' '}
                    <span className="mono" style={{ fontWeight: 800 }}>
                      {mfaDemo}
                    </span>
                  </div>
                ) : null}
                <input
                  id="li-mfa"
                  className="mono"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                  style={{ fontSize: '1.1rem', letterSpacing: '.2em', textAlign: 'center' }}
                />
                <p className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                  {mfaMethod === 'email'
                    ? 'Check your inbox for the 6-digit sign-in code.'
                    : 'From Google Authenticator, Microsoft Authenticator, or similar.'}
                </p>
              </div>
            ) : null}
            {needEmailOtp ? (
              <div className="fg">
                <label htmlFor="li-eotp">Email verification code</label>
                {emailOtpDemo ? (
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
                    <b>Local/dev only:</b> code{' '}
                    <span className="mono" style={{ fontWeight: 800 }}>
                      {emailOtpDemo}
                    </span>
                  </div>
                ) : null}
                <input
                  id="li-eotp"
                  className="mono"
                  maxLength={6}
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="000000"
                  style={{ fontSize: '1.1rem', letterSpacing: '.2em', textAlign: 'center' }}
                  required
                />
                <p className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                  Sent to your work email every 90 days to confirm the mailbox still works.
                </p>
              </div>
            ) : null}
            {info ? <div style={{ color: 'var(--g2)', fontSize: '.8rem', marginBottom: '.5rem' }}>{info}</div> : null}
            {error ? (
              <div style={{ color: 'var(--rd)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</div>
            ) : null}
            <button
              className="btn bp"
              style={{ width: '100%', justifyContent: 'center' }}
              type="submit"
              disabled={busy || (!needMfa && !needEmailOtp && !captchaReady)}
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="forgot">
              <a
                onClick={() => {
                  setReset(true);
                  refreshCaptcha();
                }}
              >
                Forgot password?
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
