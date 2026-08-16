import { useEffect, useState } from 'react';
import { dataApi } from '../api';
import { downloadCsv } from '../lib/csv';

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
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');

  useEffect(() => {
    dataApi
      .auditLog(200, q || undefined, entity || undefined)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit log'));
  }, [q, entity]);

  return (
    <div>
      <div className="f-row">
        <h1 className="h1">Audit trail</h1>
        <button
          type="button"
          className="btn secondary"
          disabled={!rows.length}
          onClick={() => downloadCsv('audit-log.csv', rows as Record<string, unknown>[])}
        >
          Export CSV
        </button>
      </div>
      <p className="muted">Append-only activity trail — retained seven years per DPDPA policy.</p>

      <div className="filters card">
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="User, action, reference…"
          />
        </label>
        <label>
          Entity
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            <option value="submission">submission</option>
            <option value="invoice">invoice</option>
            <option value="user">user</option>
            <option value="auth">auth</option>
          </select>
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="dim">{r.ts.slice(0, 19).replace('T', ' ')}</td>
                <td>{r.actorEmail}</td>
                <td>{r.action}</td>
                <td>{r.entity}</td>
                <td className="dim">{r.entityId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
