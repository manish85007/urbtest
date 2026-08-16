import { useEffect, useState } from 'react';
import { dataApi } from '../api';

export function AuditPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      ts: string;
      actorEmail: string;
      action: string;
      entity: string;
      entityId: string | null;
    }>
  >([]);
  const [error, setError] = useState('');

  useEffect(() => {
    dataApi
      .auditLog()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit log'));
  }, []);

  return (
    <div>
      <h1 className="h1">Audit log</h1>
      <p className="muted">Append-only activity trail — retained seven years per DPDPA policy.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="dim">{r.ts.slice(0, 19).replace('T', ' ')}</td>
                <td>{r.actorEmail}</td>
                <td>{r.action}</td>
                <td>
                  {r.entity}
                  {r.entityId ? <span className="dim"> · {r.entityId}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
