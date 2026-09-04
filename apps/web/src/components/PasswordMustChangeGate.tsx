import { useState } from 'react';
import { authApi } from '../api';
import { LogoPrimary } from './BrandMark';

interface PasswordMustChangeGateProps {
  onChanged: () => void;
}

export function PasswordMustChangeGate({ onChanged }: PasswordMustChangeGateProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <LogoPrimary />
        <h1 className="h1">Change your password</h1>
        <p className="muted">
          You signed in with a temporary password. Choose a new password before continuing. It must
          be at least 10 characters with upper-case, lower-case, and a digit.
        </p>
        <form className="sub-form" onSubmit={submit} style={{ border: 'none', paddingTop: 0 }}>
          <div className="fg">
            <label htmlFor="pw-current">Current (temporary) password</label>
            <input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="pw-next">New password</label>
            <input
              id="pw-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          <div className="fg">
            <label htmlFor="pw-confirm">Confirm new password</label>
            <input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn bp" disabled={busy}>
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
