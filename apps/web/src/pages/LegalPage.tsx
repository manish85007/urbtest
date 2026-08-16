import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { legalApi } from '../api';

export function LegalPage() {
  const { key } = useParams<{ key: string }>();
  const [doc, setDoc] = useState<{ title: string; version: string; body: string; effectiveDate: string } | null>(
    null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!key) return;
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
