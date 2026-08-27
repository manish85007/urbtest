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
  const [acknowledged, setAcknowledged] = useState(false);

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
    if (!acknowledged) return;
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
        <h1 className="h1">User acceptance required</h1>
        <p className="muted">
          Before you use Urb TecTrack, please read and accept our current policies. By accepting,
          you confirm that you have read, understood and agree to be bound by the Terms of Use and
          consent to the processing of your personal data as described in the Privacy &amp; Data
          Notice, in accordance with the Digital Personal Data Protection Act, 2023 (India).
        </p>
        <ul className="list">
          {pending.map((p) => (
            <li key={p.key}>
              <Link to={`/legal/${p.key}`}>
                {p.title}
              </Link>{' '}
              <span className="dim">version {p.version}</span>
            </li>
          ))}
        </ul>
        <label className="legal-consent-check">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            I have read the policies linked above and agree to the Terms of Use and Privacy &amp;
            Data Notice (electronic acceptance).
          </span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button
          type="button"
          className="btn primary"
          disabled={busy || !acknowledged}
          onClick={() => void acceptAll()}
        >
          Accept and continue
        </button>
        <p className="dim legal-consent-foot">
          Your acceptance is recorded with your account, policy version and timestamp for audit
          purposes.
        </p>
      </div>
    </div>
  );
}
