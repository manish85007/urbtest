import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  dataApi,
  filesApi,
  type ClientSummary,
  type PeriodQuery,
  type RegisterReport,
  type RegisterType,
  type SessionUser,
  type SiteSummary,
} from '../api';
import { downloadCsvGrid } from '../lib/csv';
import { isClientPortalUser, isStaffUser } from '../lib/permissions';
import { PeriodPicker } from '../components/PeriodPicker';

const KINDS: Array<{
  id: RegisterType;
  label: string;
  description: string;
  /** Hidden from factory manager accounts */
  factoryHidden?: boolean;
  /** Hidden from client portal accounts */
  clientHidden?: boolean;
}> = [
  { id: 'summary', label: 'Request Summary', description: 'Every request with stage, weight and dates', factoryHidden: true },
  { id: 'complete', label: 'Complete Request Summary', description: 'Full lifecycle — invoice, MRN, Form 6, CoD, materials and dates' },
  { id: 'invoices', label: 'Invoice Register', description: 'All invoices with e-way, payment status and outstanding', factoryHidden: true },
  { id: 'mrn', label: 'MRN Register', description: 'Goods received at factory sites — internal', clientHidden: true },
  { id: 'form6', label: 'Form 6 Log', description: 'FY-indexed manifests with invoice weight, vehicles and categories' },
  {
    id: 'serials',
    label: 'Device Serials',
    description: 'Per-device register — serial, asset tag, make/model, custody, Device CoD and recycling details',
  },
  { id: 'cod', label: 'Certificate Log', description: 'Certificates issued and closure status' },
  { id: 'category', label: 'Category Recovery', description: 'Weight recovered by authorized category' },
  { id: 'sustain', label: 'Sustainability', description: 'Environmental impact with methodology', factoryHidden: true },
  { id: 'heroes', label: 'Recycling Heroes', description: 'Tonnage and tree milestones', factoryHidden: true },
];

const DISPLAY_CAP = 300;

interface ReportsPageProps {
  user: SessionUser;
}

export function ReportsPage({ user }: ReportsPageProps) {
  const isStaff = isStaffUser(user) || user.role === 'auditor';
  const isClient = isClientPortalUser(user);
  const available = KINDS.filter((k) => {
    if (isClient && k.clientHidden) return false;
    if (user.role === 'factory' && k.factoryHidden) return false;
    return true;
  });
  const [params, setParams] = useSearchParams();
  const typeParam = params.get('type') as RegisterType | null;
  const type: RegisterType = available.some((k) => k.id === typeParam)
    ? (typeParam as RegisterType)
    : (available[0]?.id ?? 'summary');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [report, setReport] = useState<RegisterReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });

  const kind = available.find((k) => k.id === type) ?? available[0];
  const scope = useMemo(
    () => ({
      clientId: isStaff ? clientId || undefined : undefined,
      siteId: siteId || undefined,
    }),
    [isStaff, clientId, siteId],
  );

  useEffect(() => {
    if (!isStaff) {
      if (user.clientId) {
        dataApi.sites(user.clientId).then(setSites).catch(() => setSites([]));
      }
      return;
    }
    dataApi.clients().then(setClients).catch(() => setClients([]));
  }, [isStaff, user.clientId]);

  useEffect(() => {
    if (!isStaff) return;
    if (!clientId) {
      setSites([]);
      setSiteId('');
      return;
    }
    dataApi
      .sites(clientId)
      .then((list) => {
        setSites(list);
        setSiteId('');
      })
      .catch(() => setSites([]));
  }, [isStaff, clientId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    dataApi
      .register(type, period, scope)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, [type, period.period, period.fy, period.year, period.from, period.to, scope.clientId, scope.siteId]);

  const pdfHref = filesApi.pdf(
    `/reports/register/${type}/pdf${qs({
      ...period,
      clientId: scope.clientId,
      siteId: scope.siteId,
    })}`,
  );

  function exportCsv() {
    if (!report?.rows.length) return;
    const slug = report.periodLabel.replace(/[^\w]+/g, '-');
    const skip = new Set(
      report.head
        .map((h, i) => (h === 'Download' ? i : -1))
        .filter((i) => i >= 0),
    );
    const head = report.head.filter((_, i) => !skip.has(i));
    const rows = report.rows.map((row) => row.filter((_, i) => !skip.has(i)));
    downloadCsvGrid(`urbeno-${type}-${slug}.csv`, head, rows);
  }

  const shown = report?.rows.slice(0, DISPLAY_CAP) ?? [];
  const requestCol = report?.head.findIndex((h) => h === 'Request') ?? -1;
  const downloadCol = report?.head.findIndex((h) => h === 'Download') ?? -1;
  const canBulkDocs =
    (type === 'cod' || type === 'form6') &&
    (isClient || user.role === 'admin' || user.role === 'operations');

  const bulkZipHref = canBulkDocs
    ? filesApi.pdf(
        `/reports/documents.zip${qs({
          type,
          ...period,
          clientId: scope.clientId,
          siteId: scope.siteId,
        })}`,
      )
    : null;

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">Reports</div>
          <div className="p-mu" style={{ margin: 0 }}>
            Generate for any period, any site, export to CSV or PDF
          </div>
        </div>
      </div>

      <PeriodPicker variant="card" value={period} onChange={setPeriod} />

      <div className="card">
        <div className="section-hd">Report & Scope</div>
        <div className="fr3">
          <div className="fg">
            <label htmlFor="report-kind">Report</label>
            <select
              id="report-kind"
              value={type}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('type', e.target.value);
                setParams(next, { replace: true });
              }}
            >
              {available.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <div className="dim" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>
              {kind?.description}
            </div>
          </div>
          {isStaff ? (
            <div className="fg">
              <label htmlFor="report-client">Client</label>
              <select
                id="report-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="fg">
            <label htmlFor="report-site">Site</label>
            <select
              id="report-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={!sites.length}
            >
              <option value="">{sites.length ? 'All sites (consolidated)' : '—'}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
          <button type="button" className="btn bp" disabled={!report?.rows.length} onClick={exportCsv}>
            ⬇ Export CSV
          </button>
          {report?.rows.length ? (
            <a className="btn bs" href={pdfHref} target="_blank" rel="noopener noreferrer">
              ⬇ Export PDF
            </a>
          ) : (
            <button type="button" className="btn bs" disabled>
              ⬇ Export PDF
            </button>
          )}
          {canBulkDocs ? (
            report?.rows.length && bulkZipHref ? (
              <a className="btn bs" href={bulkZipHref} target="_blank" rel="noopener noreferrer">
                ⬇ Download all {type === 'cod' ? 'CoD' : 'Form 6'} PDFs
              </a>
            ) : (
              <button type="button" className="btn bs" disabled>
                ⬇ Download all {type === 'cod' ? 'CoD' : 'Form 6'} PDFs
              </button>
            )
          ) : null}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card" style={{ padding: '.4rem' }}>
        {loading ? <p className="muted pad">Loading…</p> : null}
        {!loading && report && !report.rows.length ? (
          <div className="empty">
            <div className="empty-t">No data for {report.periodLabel}</div>
            <div style={{ fontSize: '.85rem' }}>Try a different period or scope</div>
          </div>
        ) : null}
        {!loading && report && report.rows.length ? (
          <>
            <div style={{ padding: '.4rem .5rem', fontSize: '.8rem', color: 'var(--mu)' }}>
              {report.total} rows · {report.periodLabel}
              {report.scopeLabel ? ` · ${report.scopeLabel}` : ''}
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    {report.head.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, ci) => (
                        <td key={ci} className={typeof cell === 'number' ? 'mono' : undefined}>
                          {ci === requestCol && typeof cell === 'string' && cell ? (
                            <Link to={`/requests/${cell}`}>{cell}</Link>
                          ) : ci === downloadCol && typeof cell === 'string' && cell ? (
                            <a className="btn bp bsm" href={filesApi.url(cell)} target="_blank" rel="noopener noreferrer">
                              ⬇ Download
                            </a>
                          ) : ci === downloadCol ? (
                            <span className="dim">—</span>
                          ) : (
                            String(cell ?? '')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.total > DISPLAY_CAP ? (
              <div className="dim" style={{ fontSize: '.75rem', padding: '.3rem .5rem' }}>
                Showing {DISPLAY_CAP} of {report.total} — export CSV for the full set
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
