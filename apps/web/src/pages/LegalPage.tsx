import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { legalApi } from '../api';
import { COMPANY } from '../lib/company';

export function LegalPage() {
  const { key } = useParams<{ key: string }>();
  const [doc, setDoc] = useState<{ title: string; version: string; body: string; effectiveDate: string } | null>(
    null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!key) return;
    if (key === 'support') {
      setDoc({
        title: 'Support',
        version: '1.0',
        effectiveDate: '2026-04-01',
        body:
          `For anything relating to a consignment, raise a query on the request concerned.\n\nPhone — ${COMPANY.phone}\nEmail — ${COMPANY.email}\nWhatsApp — ${COMPANY.waUrl}\n\nIf you cannot sign in, use Forgot password on the login screen for an email OTP, then change it from Profile.`,
      });
      setError('');
      return;
    }
    legalApi
      .document(key)
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load document'));
  }, [key]);

  return (
    <div>
      <p className="muted">
        <Link to="/">← Dashboard</Link>
      </p>
      {error ? <p className="error">{error}</p> : null}
      {!doc ? (
        <p className="muted">Loading…</p>
      ) : (
        <article className="card legal-doc">
          <h1 className="h1">{doc.title}</h1>
          <p className="muted">
            Version {doc.version} · effective {doc.effectiveDate.slice(0, 10)}
          </p>
          <div className="legal-body">{doc.body}</div>
        </article>
      )}
    </div>
  );
}
