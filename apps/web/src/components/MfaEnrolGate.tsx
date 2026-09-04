import { useState } from 'react';
import { authApi } from '../api';
import { LogoPrimary } from './BrandMark';

interface MfaEnrolGateProps {
  graceDays: number;
  onEnrolled: () => void;
}

export function MfaEnrolGate({ graceDays, onEnrolled }: MfaEnrolGateProps) {
  const [enrol, setEnrol] = useState<{
    method: 'totp' | 'email';
    secret?: string;
    qrDataUrl?: string;
    demoCode?: string | null;
  } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  async function start(method: 'totp' | 'email') {
    setError('');
    setBusy(true);
    try {
      const r = await authApi.mfaStart(method);
      setEnrol({
        method: r.method,
        secret: r.secret,
        qrDataUrl: r.qrDataUrl,
        demoCode: r.demoCode,
      });
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start enrolment');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enrol) return;
    setError('');
    setBusy(true);
    try {
      await authApi.mfaConfirm({
        method: enrol.method,
        secret: enrol.secret,
        code,
      });
      onEnrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrolment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <LogoPrimary />
        <h1 className="h1">Set up two-factor authentication</h1>
        <p className="muted">
          Two-factor authentication is mandatory for Urbeno staff (admin, operations, and factory)
          within {graceDays} days of account creation. Your grace period has ended — enrol now to
          continue.
        </p>

        {!enrol ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginTop: '.8rem' }}>
            <button type="button" className="btn bp" disabled={busy} onClick={() => void start('totp')}>
              Use authenticator app
            </button>
            <button type="button" className="btn bs" disabled={busy} onClick={() => void start('email')}>
              Use email OTP
            </button>
          </div>
        ) : null}

        {enrol?.method === 'totp' && enrol.qrDataUrl && enrol.secret ? (
          <form className="sub-form" onSubmit={confirm} style={{ border: 'none', paddingTop: '.6rem' }}>
            <p className="dim" style={{ fontSize: '.84rem' }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code.
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
              <img src={enrol.qrDataUrl} alt="QR code to enrol authenticator app" width={180} height={180} />
            </div>
            <p className="dim" style={{ fontSize: '.78rem' }}>
              Or enter the key manually:{' '}
              <button type="button" className="btn-link" onClick={() => setShowSecret((s) => !s)}>
                {showSecret ? 'hide' : 'show'}
              </button>
              {showSecret ? (
                <span className="mono" style={{ display: 'block', marginTop: '.25rem' }}>
                  {enrol.secret}
                </span>
              ) : null}
            </p>
            <div className="fg">
              <label htmlFor="mfa-force-code">Authenticator code</label>
              <input
                id="mfa-force-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={6}
                maxLength={8}
              />
            </div>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn bp" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm and continue'}
            </button>
          </form>
        ) : null}

        {enrol?.method === 'email' ? (
          <form className="sub-form" onSubmit={confirm} style={{ border: 'none', paddingTop: '.6rem' }}>
            <p className="dim" style={{ fontSize: '.84rem' }}>
              Enter the 6-digit code we emailed you.
            </p>
            {enrol.demoCode ? (
              <p className="dim">
                Demo code: <span className="mono">{enrol.demoCode}</span>
              </p>
            ) : null}
            <div className="fg">
              <label htmlFor="mfa-force-email">Email code</label>
              <input
                id="mfa-force-email"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={6}
                maxLength={8}
              />
            </div>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn bp" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm and continue'}
            </button>
          </form>
        ) : null}

        {error && !enrol ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
