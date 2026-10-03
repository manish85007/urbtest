import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { emailsApi, type EmailHealthReport } from '../api';

function when(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Super Admin warning when outgoing mail (sign-in codes, notifications) is failing.
 * `detailed` adds status + "Check now" for the Masters outgoing-mail settings.
 */
export function EmailHealthBanner({ detailed = false }: { detailed?: boolean }) {
  const [health, setHealth] = useState<EmailHealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    emailsApi.emailHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  async function checkNow() {
    setBusy(true);
    setError('');
    try {
      setHealth(await emailsApi.checkEmailHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  if (!health) return null;
  if (health.ok && !detailed) return null;

  if (health.ok) {
    return (
      <div className="note-box" style={{ marginBottom: '.8rem', background: 'var(--g3)' }}>
        <b>Outgoing mail is working.</b>{' '}
        <span className="dim" style={{ fontSize: '.82rem' }}>
          Last check {when(health.checkedAt)} · last email sent {when(health.lastSentAt)}
          {health.queued ? ` · ${health.queued} queued` : ''}
        </span>{' '}
        <button type="button" className="btn" disabled={busy} onClick={() => void checkNow()}>
          {busy ? 'Checking…' : 'Check now'}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div
      className="note-box"
      role="alert"
      style={{ marginBottom: '.8rem', background: 'var(--rd2)', color: 'var(--rd)', borderColor: 'var(--rd)' }}
    >
      <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>
        Outgoing email is failing{health.failingSince ? ` since ${when(health.failingSince)}` : ''}
      </div>
      <div style={{ fontSize: '.85rem' }}>
        Sign-in codes, password resets and notifications are not being delivered.
        {health.failedLast24h ? ` ${health.failedLast24h} email(s) failed in the last 24 hours.` : ''}
      </div>
      {health.hint ? <div style={{ fontSize: '.85rem', marginTop: '.3rem' }}>{health.hint}</div> : null}
      {health.error ? (
        <div className="mono" style={{ fontSize: '.75rem', marginTop: '.3rem', wordBreak: 'break-word' }}>
          {health.error}
        </div>
      ) : null}
      <div style={{ marginTop: '.45rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void checkNow()}>
          {busy ? 'Checking…' : 'Check again'}
        </button>
        {!detailed ? <Link to="/masters?tab=email">Outgoing mail settings</Link> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
