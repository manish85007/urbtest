import { useEffect, useState } from 'react';
import { stageLabel } from '@urb-tectrack/shared';
import { dataApi, type SessionUser, type SubmissionSummary } from '../api';

interface DashboardPageProps {
  user: SessionUser;
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [stats, setStats] = useState<{ openRequests: number; openInvoices: number; activeClients: number } | null>(
    null,
  );
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      user.role !== 'client' ? dataApi.dashboard() : Promise.resolve(null),
      dataApi.submissions(),
    ])
      .then(([dash, list]) => {
        if (dash) setStats(dash);
        setSubs(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, [user.role]);

  return (
    <div>
      <h1 className="h1">Dashboard</h1>
      <p className="muted">Welcome back, {user.name}.</p>

      {error ? <p className="error">{error}</p> : null}

      {stats ? (
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Open requests</div>
            <div className="stat-value">{stats.openRequests}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Open invoices</div>
            <div className="stat-value">{stats.openInvoices}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Active clients</div>
            <div className="stat-value">{stats.activeClients}</div>
          </div>
        </div>
      ) : null}

      <section className="card">
        <h2>Recent requests</h2>
        {subs.length === 0 ? (
          <p className="muted">No requests yet. Phase 3 will wire the full 9-stage lifecycle.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Site</th>
                  <th>Stage</th>
                  <th>Weight (kg)</th>
                  <th>Invoices</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.clientName}</td>
                    <td>{s.siteName}</td>
                    <td>
                      <span className="badge">{stageLabel(s.stage)}</span>
                    </td>
                    <td>{s.approxWeight}</td>
                    <td>{s.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
