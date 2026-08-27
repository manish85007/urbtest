import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { legalApi } from '../api';
import { COMPANY } from '../lib/company';

interface LegalPageProps {
  standalone?: boolean;
}

const SECTION_RE = /^(?:\d+\.\s+.+|[A-Z][A-Za-z &/()]{2,80})$/;

function renderLegalBody(body: string): ReactNode {
  const blocks = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, i) => {
    const lines = block.split('\n');
    const first = lines[0]?.trim() ?? '';
    const rest = lines.slice(1).join('\n').trim();

    if (i === 0 && /^Version\s/i.test(first) && !rest) {
      return (
        <p key={i} className="meta">
          {first}
        </p>
      );
    }

    if (SECTION_RE.test(first) && lines.length === 1) {
      return <h4 key={i}>{first}</h4>;
    }

    if (SECTION_RE.test(first) && rest) {
      return (
        <div key={i}>
          <h4>{first}</h4>
          {rest.split('\n').map((line, j) =>
            line.trim().startsWith('•') ? (
              <p key={j} className="legal-bullet">
                {line.trim()}
              </p>
            ) : (
              <p key={j}>{line}</p>
            ),
          )}
        </div>
      );
    }

    if (lines.every((l) => l.trim().startsWith('•'))) {
      return (
        <ul key={i}>
          {lines.map((line, j) => (
            <li key={j}>{line.replace(/^•\s*/, '')}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
        {block}
      </p>
    );
  });
}

export function LegalPage({ standalone = false }: LegalPageProps) {
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
          `Getting help\nFor anything relating to a consignment — a pickup, a document, an invoice — raise a query directly on the request concerned. It reaches the team handling that consignment and stays attached to the record.\n\nContact\n• Phone — ${COMPANY.phone}\n• Email — ${COMPANY.email}\n• WhatsApp — ${COMPANY.waUrl}\n\nAccount problems\nIf you cannot sign in, use Forgot password on the login screen for a six-digit code by email, then change your password from Profile.`,
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
    <div className={standalone ? 'standalone-page' : undefined}>
      <p className="muted">
        <Link to="/">{standalone ? '← Sign in' : '← Dashboard'}</Link>
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
          <div className="legal-body legal">{renderLegalBody(doc.body)}</div>
        </article>
      )}
    </div>
  );
}
