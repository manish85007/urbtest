import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api';

interface LegalConsentGateProps {
  onAccepted: () => void;
}

export function LegalConsentGate({ onAccepted }: LegalConsentGateProps) {
  const [pending, setPending] = useState<Array<{ key: string; title: string; version: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi
      .legalStatus()
      .then((s) => {
        setPending(s.pending);
        if (s.compliant) onAccepted();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load legal status'))
      .finally(() => setLoaded(true));
  }, [onAccepted]);

  async function acceptAll() {
    setBusy(true);
    setError('');
    try {
      await authApi.acceptLegal(pending.map((p) => p.key));
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptance failed');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <div className="center">Checking policies…</div>;
  }

  if (!pending.length) {
    return null;
  }

  return (
    <div className="login">
      <div className="login-box legal-consent">
        <h1 className="h1">Accept policies to continue</h1>
        <p className="muted">
          Under the Digital Personal Data Protection Act, 2023, please review and accept the current
          policies before using Urb TecTrack.
        </p>
        <ul className="list">
          {pending.map((p) => (
            <li key={p.key}>
              <Link to={`/legal/${p.key}`} target="_blank" rel="noreferrer">
                {p.title}
              </Link>{' '}
              <span className="dim">v{p.version}</span>
            </li>
          ))}
        </ul>
        {error ? <p className="error">{error}</p> : null}
        <button type="button" className="btn primary" disabled={busy} onClick={() => void acceptAll()}>
          I accept the policies above
        </button>
      </div>
    </div>
  );
}
