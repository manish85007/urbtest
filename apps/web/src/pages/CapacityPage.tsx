import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dataApi, type CapacityReport, type SessionUser } from '../api';

interface CapacityPageProps {
  user: SessionUser;
}

export function CapacityPage({ user }: CapacityPageProps) {
  const [factories, setFactories] = useState<Array<{ id: string; name: string }>>([]);
  const [factoryId, setFactoryId] = useState('');
  const [report, setReport] = useState<CapacityReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dataApi
      .factories()
      .then((list) => {
        setFactories(list);
        const pick =
          user.role === 'factory' && user.factoryIds?.length
            ? user.factoryIds[0]
            : list[0]?.id ?? '';
        setFactoryId(pick);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load factories'));
  }, [user]);

  useEffect(() => {
    if (!factoryId) return;
    dataApi
      .capacity(factoryId)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load capacity'));
  }, [factoryId]);

  return (
    <div>
      <div className="f-row">
        <h1 className="h1">Capacity utilization</h1>
        {user.role === 'admin' ? (
          <Link to="/masters" className="btn ghost">
            Category master →
          </Link>
        ) : null}
      </div>
      <p className="muted">TPA authorization vs processed weight in the current financial year.</p>

      <label className="inline-label">
        Factory
        <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="error">{error}</p> : null}
      {!report ? <p className="muted">Loading…</p> : null}

      {report ? (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Authorized (kg)</div>
              <div className="stat-value sm">{report.stats.authorized.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Processed (kg)</div>
              <div className="stat-value sm">{report.stats.processed.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Utilization</div>
              <div className="stat-value sm">{report.stats.utilization.toFixed(1)}%</div>
            </div>
            <div className="stat">
              <div className="stat-label">Entries at risk</div>
              <div className="stat-value warn">{report.stats.atRisk}</div>
            </div>
          </div>

          {report.alerts.length > 0 ? (
            <section className="card alert-warn">
              <h2>Capacity alerts</h2>
              <ul className="list">
                {report.alerts.map((a) => (
                  <li key={a.entryId}>
                    <strong>{a.entryId}</strong> — {a.description} ({a.pct.toFixed(1)}% of{' '}
                    {a.capacityTpa} TPA)
                    {a.exceeded ? <span className="badge danger"> Exceeded</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card">
            <h2>By authorization entry</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Group</th>
                    <th>Description</th>
                    <th>Used (kg)</th>
                    <th>Cap (kg)</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.slice(0, 100).map((e) => (
                    <tr key={e.entryId}>
                      <td>{e.entryId}</td>
                      <td>{e.groupCode}</td>
                      <td>{e.description}</td>
                      <td>{e.usedKg.toFixed(1)}</td>
                      <td>{e.capKg.toFixed(0)}</td>
                      <td>
                        <span className={`badge ${e.exceeded ? 'danger' : e.atRisk ? 'warn' : ''}`}>
                          {e.pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
