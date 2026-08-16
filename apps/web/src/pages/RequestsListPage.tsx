import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STAGES, stageLabel } from '@urb-tectrack/shared';
import { dataApi, type SessionUser, type SubmissionSummary } from '../api';

interface RequestsListPageProps {
  user: SessionUser;
}

export function RequestsListPage({ user }: RequestsListPageProps) {
  const [rows, setRows] = useState<SubmissionSummary[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [clientId, setClientId] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const isStaff = user.role === 'admin' || user.role === 'factory';

  useEffect(() => {
    dataApi
      .submissions()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    if (isStaff) {
      dataApi.clients().then(setClients).catch(() => undefined);
    }
  }, [isStaff]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!showClosed && r.stage >= 9) return false;
      if (stage && String(r.stage) !== stage) return false;
      if (clientId && r.clientId !== clientId) return false;
      if (q) {
        const hay = `${r.id} ${r.clientName} ${r.siteName}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, stage, clientId, showClosed]);

  return (
    <div>
      <div className="f-row">
        <h1 className="h1">{isStaff ? 'Requests' : 'My Requests'}</h1>
        <Link to="/requests/new" className="btn bp">
          + New Request
        </Link>
      </div>

      <div className="filters card">
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Request ID, client, site…"
          />
        </label>
        <label>
          Stage
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s.n} value={String(s.n)}>
                {s.n}. {s.l}
              </option>
            ))}
          </select>
        </label>
        {isStaff ? (
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="check-label">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Include closed
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                {isStaff ? <th>Client</th> : null}
                <th>Site</th>
                <th>Stage</th>
                <th>Invoices</th>
                <th>Net kg</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="click-row">
                  <td>
                    <Link to={`/requests/${r.id}`}>{r.id}</Link>
                  </td>
                  {isStaff ? <td>{r.clientName}</td> : null}
                  <td>{r.siteName}</td>
                  <td>
                    <span className="badge">{stageLabel(r.stage)}</span>
                  </td>
                  <td>{r.invoiceCount}</td>
                  <td>{r.approxWeight}</td>
                  <td className="dim">{r.requestDate.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <p className="muted pad">No requests match your filters.</p> : null}
      </section>
    </div>
  );
}
