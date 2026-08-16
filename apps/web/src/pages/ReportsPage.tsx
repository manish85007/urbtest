import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR } from '@urb-tectrack/shared';
import { dataApi, type RegisterType, type SessionUser } from '../api';
import { downloadCsv } from '../lib/csv';

const REPORTS: Array<{ id: RegisterType; label: string; staffOnly?: boolean }> = [
  { id: 'summary', label: 'Request Summary' },
  { id: 'invoices', label: 'Invoice Register' },
  { id: 'mrn', label: 'MRN Register', staffOnly: true },
  { id: 'form6', label: 'Form 6 Log' },
  { id: 'cod', label: 'Certificate Log' },
];

interface ReportsPageProps {
  user: SessionUser;
}

export function ReportsPage({ user }: ReportsPageProps) {
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const available = REPORTS.filter((r) => !r.staffOnly || isStaff);
  const [type, setType] = useState<RegisterType>(available[0]?.id ?? 'summary');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    dataApi
      .register(type)
      .then((data) => setRows(data as Record<string, unknown>[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [type]);

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="f-row">
        <h1 className="h1">Reports</h1>
        <button
          type="button"
          className="btn secondary"
          disabled={!rows.length}
          onClick={() => downloadCsv(`${type}-report.csv`, rows)}
        >
          Export CSV
        </button>
      </div>
      <p className="muted">Financial year reporting aligned with the prototype registers.</p>

      <div className="tabs">
        {available.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`tab ${type === r.id ? 'on' : ''}`}
            onClick={() => setType(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {headers.map((h) => (
                    <td key={h}>
                      {h === 'submissionId' && typeof row[h] === 'string' ? (
                        <Link to={`/requests/${row[h]}`}>{String(row[h])}</Link>
                      ) : h === 'totalPaise' ? (
                        formatINR(Number(row[h]) / 100)
                      ) : (
                        String(row[h] ?? '')
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !rows.length ? <p className="muted pad">No rows for this report.</p> : null}
      </section>

      {user.role === 'client' ? (
        <p className="muted">
          See also <Link to="/impact">Sustainability Impact</Link> and{' '}
          <Link to="/heroes">Recycle Heroes</Link>.
        </p>
      ) : null}
    </div>
  );
}
