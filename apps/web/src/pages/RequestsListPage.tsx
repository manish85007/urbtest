import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { STAGES, getFY, listFiscalYears } from '@urb-tectrack/shared';
import { dataApi, type SessionUser, type SubmissionSummary } from '../api';
import { StageBadge } from '../components/StageProgress';
import { fmtDate, num } from '../lib/format';

interface RequestsListPageProps {
  user: SessionUser;
}

export function RequestsListPage({ user }: RequestsListPageProps) {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<SubmissionSummary[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const stage = params.get('stage') ?? '';
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [fy, setFy] = useState('');

  const isStaff = user.role === 'admin' || user.role === 'factory';
  const canCreate = user.role === 'client' || user.role === 'admin';
  const years = listFiscalYears();

  useEffect(() => {
    dataApi
      .submissions()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    if (isStaff) {
      dataApi.clients().then(setClients).catch(() => undefined);
    }
  }, [isStaff]);

  useEffect(() => {
    if (user.role === 'client' && user.clientId) {
      dataApi.sites(user.clientId).then(setSites).catch(() => undefined);
    } else if (clientId) {
      dataApi.sites(clientId).then(setSites).catch(() => undefined);
    } else {
      setSites([]);
    }
    setSiteId('');
  }, [clientId, user.clientId, user.role]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (stage && String(r.stage) !== stage) return false;
      if (clientId && r.clientId !== clientId) return false;
      if (siteId && r.siteId !== siteId) return false;
      if (fy) {
        const label = getFY(r.requestDate)?.label;
        if (label !== fy) return false;
      }
      if (q) {
        const hay = `${r.id} ${r.ref ?? ''} ${r.location ?? ''} ${r.clientName} ${r.siteName}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, stage, clientId, siteId, fy]);

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <h1 className="h1">{isStaff ? 'All Requests' : 'My Requests'}</h1>
          <div className="p-mu" style={{ margin: 0 }}>
            {filtered.length} of {rows.length} requests
          </div>
        </div>
        <div className="spacer" />
        {canCreate ? (
          <Link to="/requests/new" className="btn bp">
            + New Request
          </Link>
        ) : null}
      </div>

      <div className="card">
        <div className="fr4">
          <div className="fg">
            <label>Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, PO, location…" />
          </div>
          <div className="fg">
            <label>Stage</label>
            <select
              value={stage}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('stage', e.target.value);
                else next.delete('stage');
                setParams(next, { replace: true });
              }}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s.n} value={String(s.n)}>
                  {s.n}. {s.l}
                </option>
              ))}
            </select>
          </div>
          {isStaff ? (
            <div className="fg">
              <label>Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setSiteId('');
                }}
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="fg">
              <label>Site</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">All sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="fg">
            <label>Financial Year</label>
            <select value={fy} onChange={(e) => setFy(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y.label} value={y.label}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isStaff && clientId ? (
          <div className="fg" style={{ maxWidth: 280, marginTop: '.5rem' }}>
            <label>Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card" style={{ padding: '.4rem' }}>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-t">No requests match</div>
          </div>
        ) : (
          <div className="tw">
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
                  <tr
                    key={r.id}
                    className="click"
                    onClick={() => nav(`/requests/${r.id}`)}
                  >
                    <td>
                      <Link to={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        <b>{r.id}</b>
                      </Link>
                      <div className="dim" style={{ fontSize: '.72rem' }}>
                        {r.ref || 'no PO'}
                      </div>
                    </td>
                    {isStaff ? <td>{r.clientName}</td> : null}
                    <td className="dim">{r.siteName}</td>
                    <td>
                      <StageBadge stage={r.stage} />
                    </td>
                    <td>
                      {r.invoices?.length ? (
                        r.invoices.map((inv) => (
                          <span
                            key={inv.invoiceNo}
                            className={`badge ${inv.stage >= 9 ? 'bg-g' : 'bg-bl'}`}
                            style={{ margin: 1 }}
                            title={`Stage ${inv.stage}`}
                          >
                            {inv.invoiceNo}
                          </span>
                        ))
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="mono">{num(r.netKg && r.netKg > 0 ? r.netKg : Number(r.approxWeight) || 0)}</td>
                    <td className="dim">{fmtDate(r.requestDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
