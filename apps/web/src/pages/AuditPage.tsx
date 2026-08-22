import { useEffect, useState } from 'react';
import { dataApi, type AuditLogPage } from '../api';
import { downloadCsvGrid } from '../lib/csv';
import { DateField } from '../components/DateField';
import { fmtTS } from '../lib/format';

const EMPTY: AuditLogPage = {
  total: 0,
  filtered: 0,
  page: 1,
  pages: 1,
  limit: 100,
  rows: [],
  actors: [],
  actions: [],
  entities: [],
};

function actionBadge(action: string): string {
  if (action.includes('delete') || action.includes('remove')) return 'bg-rd';
  if (action.includes('create') || action.includes('add')) return 'bg-g';
  return 'bg-bl';
}

function detailText(details: unknown): string {
  try {
    return JSON.stringify(details ?? {}).slice(0, 140);
  } catch {
    return '';
  }
}

export function AuditPage() {
  const [data, setData] = useState<AuditLogPage>(EMPTY);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, actor, action, entity, from, to, sort]);

  useEffect(() => {
    dataApi
      .auditLog({
        q: qDebounced || undefined,
        actor: actor || undefined,
        action: action || undefined,
        entity: entity || undefined,
        from: from || undefined,
        to: to || undefined,
        sort,
        page,
        limit: 100,
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit log'));
  }, [qDebounced, actor, action, entity, from, to, sort, page]);

  function clearFilters() {
    setQ('');
    setQDebounced('');
    setActor('');
    setAction('');
    setEntity('');
    setFrom('');
    setTo('');
    setSort('newest');
    setPage(1);
  }

  async function exportCsv() {
    const all = await dataApi.auditLog({
      q: qDebounced || undefined,
      actor: actor || undefined,
      action: action || undefined,
      entity: entity || undefined,
      from: from || undefined,
      to: to || undefined,
      sort,
      page: 1,
      limit: 5000,
    });
    downloadCsvGrid(
      `urbeno-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'User', 'Email', 'Action', 'Entity', 'Reference', 'Details'],
      all.rows.map((r) => [
        fmtTS(r.ts),
        r.actorName || '',
        r.actorEmail,
        r.action,
        r.entity,
        r.entityId || '',
        JSON.stringify(r.details ?? {}),
      ]),
    );
  }

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <h1 className="h1">Audit Trail</h1>
          <div className="p-mu" style={{ margin: 0 }}>
            {data.filtered} of {data.total} entries · immutable · retained 7 years
          </div>
        </div>
        <div className="spacer" />
        <button type="button" className="btn bs" disabled={!data.filtered} onClick={() => void exportCsv()}>
          ⬇ Export filtered CSV
        </button>
      </div>

      <div className="card">
        <div className="fr4">
          <div className="fg">
            <label>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="anything — id, action, detail…"
            />
          </div>
          <div className="fg">
            <label>User</label>
            <select value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">All users</option>
              {data.actors.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {data.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Entity</label>
            <select value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">All entities</option>
              {data.entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fr4">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          <div className="fg">
            <label>Sort</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="actor">By user</option>
              <option value="action">By action</option>
            </select>
          </div>
          <div className="fg">
            <label style={{ visibility: 'hidden' }}>Clear</label>
            <button type="button" className="btn bs" style={{ width: '100%', justifyContent: 'center' }} onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card" style={{ padding: '.4rem' }}>
        {!data.rows.length ? (
          <div className="empty">
            <div className="empty-t">No entries match</div>
          </div>
        ) : (
          <>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Reference</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                        {fmtTS(r.ts)}
                      </td>
                      <td>
                        {r.actorName || r.actorEmail}
                        <div className="dim" style={{ fontSize: '.7rem' }}>
                          {r.actorEmail}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${actionBadge(r.action)}`}>{r.action}</span>
                      </td>
                      <td className="dim">{r.entity}</td>
                      <td className="mono" style={{ fontSize: '.78rem' }}>
                        {r.entityId || ''}
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <div className="dim" style={{ fontSize: '.73rem', wordBreak: 'break-word' }}>
                          {detailText(r.details)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 ? (
              <div style={{ display: 'flex', gap: '.3rem', justifyContent: 'center', padding: '.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn bs bsm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: '.82rem' }}>
                  Page {data.page} of {data.pages}
                </span>
                <button
                  type="button"
                  className="btn bs bsm"
                  disabled={data.page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
