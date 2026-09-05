import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { legalApi } from '../api';
import { COMPANY, mailtoHref, phoneTelHref, waMeUrl } from '../lib/company';

interface LegalPageProps {
  standalone?: boolean;
}

interface SupportContact {
  phone: string;
  email: string;
  wa: string;
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

function SupportArticle({ contact }: { contact: SupportContact }) {
  const phone = contact.phone || COMPANY.phone;
  const email = contact.email || COMPANY.email;
  const wa = contact.wa || COMPANY.wa;
  const linkStyle = { color: 'var(--g)' as const };

  return (
    <article className="card legal-doc">
      <h1 className="h1">Support</h1>
      <p className="muted">Contact details from Masters → Company &amp; Letterhead</p>
      <div className="legal-body legal">
        <h4>Getting help</h4>
        <p>
          For anything relating to a consignment — a pickup, a document, an invoice — raise a query
          directly on the request concerned. It reaches the team handling that consignment and stays
          attached to the record.
        </p>
        <h4>Contact</h4>
        <ul>
          <li>
            Phone —{' '}
            <a href={`tel:${phoneTelHref(phone)}`} style={linkStyle}>
              {phone}
            </a>
          </li>
          <li>
            Email —{' '}
            <a href={mailtoHref(email)} style={linkStyle}>
              {email}
            </a>
          </li>
          <li>
            WhatsApp —{' '}
            <a href={waMeUrl(wa)} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Chat on WhatsApp
            </a>
          </li>
        </ul>
        <h4>Account problems</h4>
        <p>
          If you cannot sign in, use Forgot password on the login screen for a six-digit code by
          email, then change your password from Profile.
        </p>
      </div>
    </article>
  );
}

export function LegalPage({ standalone = false }: LegalPageProps) {
  const { key } = useParams<{ key: string }>();
  const [doc, setDoc] = useState<{ title: string; version: string; body: string; effectiveDate: string } | null>(
    null,
  );
  const [support, setSupport] = useState<SupportContact | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!key) return;
    setError('');
    setDoc(null);
    setSupport(null);

    if (key === 'support') {
      legalApi
        .companyContact()
        .then((c) => setSupport({ phone: c.phone, email: c.email, wa: c.wa }))
        .catch(() =>
          setSupport({ phone: COMPANY.phone, email: COMPANY.email, wa: COMPANY.wa }),
        );
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
      {key === 'support' ? (
        support ? (
          <SupportArticle contact={support} />
        ) : (
          <p className="muted">Loading…</p>
        )
      ) : !doc ? (
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
