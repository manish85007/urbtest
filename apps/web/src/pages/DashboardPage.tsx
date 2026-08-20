import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  dataApi,
  type ClientDashboardReport,
  type DashboardReport,
  type SessionUser,
} from '../api';
import { BarChart, DonutChart } from '../components/charts';
import { StageBadge } from '../components/StageProgress';
import { fmtDate, num } from '../lib/format';
import { useAnimatedNumber } from '../lib/useAnimatedNumber';
import { AdminDashboard } from './admin/AdminDashboard';

interface DashboardPageProps {
  user: SessionUser;
}

function ClientDashboard({
  user,
  report,
  siteId,
  onSite,
}: {
  user: SessionUser;
  report: ClientDashboardReport;
  siteId: string;
  onSite: (id: string) => void;
}) {
  const nav = useNavigate();
  const first = user.name.split(' ')[0];
  const { impact } = report;
  const siteName = report.sites.find((s) => s.id === siteId)?.name;
  const requests = report.requests;

  const openCount = useAnimatedNumber(report.counts.open);
  const closedCount = useAnimatedNumber(report.counts.closed);
  const recycledKg = useAnimatedNumber(Math.round(impact.kg));
  const treesCount = useAnimatedNumber(report.treesPlanted);

  const reqSlices = [
    { value: report.counts.open, color: '#3b82f6', label: 'Open' },
    { value: report.counts.closed, color: '#22c55e', label: 'Completed' },
  ];
  const ecoMax = Math.max(impact.kg, impact.co2, impact.landfill, 1);
  const ecoBars = [
    { label: 'Recycled', value: impact.kg, color: '#22c55e', unit: 'kg' },
    { label: 'CO₂ Avoided', value: impact.co2, color: '#3b82f6', unit: 'kg' },
    { label: 'Landfill Saved', value: impact.landfill, color: '#f59e0b', unit: 'kg' },
  ];

  return (
    <div className="client-dash">
      {/* Header */}
      <div className="f-row" style={{ marginBottom: '1rem' }}>
        <div>
          <div className="h1">Welcome, {first}</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {report.clientName || user.name} · {report.period.fy}
            {siteName ? ` · ${siteName}` : ' · all sites'}
          </div>
        </div>
        <div className="spacer" />
        <Link to="/requests/new" className="btn bp">
          + New Request
        </Link>
      </div>

      {/* Site filter chips */}
      {report.sites.length > 1 ? (
        <div className="client-site-chips">
          <button type="button" className={`client-site-chip ${!siteId ? 'on' : ''}`} onClick={() => onSite('')}>
            All sites
          </button>
          {report.sites.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`client-site-chip ${siteId === st.id ? 'on' : ''}`}
              onClick={() => onSite(siteId === st.id ? '' : st.id)}
            >
              {st.name} · {st.open} open
            </button>
          ))}
        </div>
      ) : null}

      {/* Quick links to portal tabs */}
      <div className="client-quick-grid">
        <Link to="/requests?status=open" className="client-quick-tile">
          <span className="client-quick-tile-ico">📋</span>
          <span className="client-quick-tile-l">My Requests</span>
          <span className="client-quick-tile-s">{report.counts.open} open · view all</span>
        </Link>
        <Link to="/impact" className="client-quick-tile">
          <span className="client-quick-tile-ico">🌱</span>
          <span className="client-quick-tile-l">Sustainability</span>
          <span className="client-quick-tile-s">{num(impact.kg)} kg recycled {report.period.fy}</span>
        </Link>
        <Link to="/heroes" className="client-quick-tile">
          <span className="client-quick-tile-ico">🌳</span>
          <span className="client-quick-tile-l">Recycle Heroes</span>
          <span className="client-quick-tile-s">{report.treesPlanted} trees planted</span>
        </Link>
        <Link to="/reports" className="client-quick-tile">
          <span className="client-quick-tile-ico">📊</span>
          <span className="client-quick-tile-l">Reports</span>
          <span className="client-quick-tile-s">Form 6, certificates &amp; more</span>
        </Link>
      </div>

      {/* Hero metrics */}
      <div className="client-dash-hero">
        <Link to="/requests?status=open" className="client-dash-metric">
          <div className="client-dash-metric-v" style={{ color: '#3b82f6' }}>
            {openCount}
          </div>
          <div className="client-dash-metric-l">Open Requests</div>
        </Link>
        <Link to="/requests?status=completed" className="client-dash-metric">
          <div className="client-dash-metric-v" style={{ color: '#22c55e' }}>
            {closedCount}
          </div>
          <div className="client-dash-metric-l">Completed</div>
        </Link>
        <Link to="/impact" className="client-dash-metric">
          <div className="client-dash-metric-v">{recycledKg}</div>
          <div className="client-dash-metric-l">Recycled kg · {report.period.fy}</div>
        </Link>
        <Link to="/heroes" className="client-dash-metric">
          <div className="client-dash-metric-v" style={{ color: '#14532d' }}>
            {treesCount}
          </div>
          <div className="client-dash-metric-l">Trees Planted</div>
        </Link>
      </div>

      {/* Action alerts */}
      {report.pendingClose.length > 0 ? (
        <div className="card client-action-card alert" style={{ background: 'var(--g3)', borderColor: 'var(--g4)' }}>
          <div className="card-hd">
            <div className="card-ttl">🏅 Certificates ready — review &amp; close</div>
            <span className="badge bg-g">{report.pendingClose.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            {report.pendingClose.map((p) => (
              <Link
                key={p.invoiceNo}
                to={`/requests/${p.submissionId}`}
                className="client-quick-tile"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>
                  <b>{p.submissionId}</b> · <span className="mono">{p.invoiceNo}</span>
                </span>
                <span className="btn bp bsm">Review &amp; Close →</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {report.pendingPickups.length > 0 ? (
        <div className="card client-action-card" style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
          <div className="card-hd">
            <div className="card-ttl" style={{ color: '#1e40af' }}>
              📅 Pending Pickups
            </div>
            <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>
              {report.pendingPickups.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {report.pendingPickups.map((p) => (
              <Link
                key={`${p.submissionId}-${p.registration}`}
                to={`/requests/${p.submissionId}`}
                className="client-quick-tile"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>
                  <b style={{ color: '#1e40af' }}>{p.submissionId}</b>
                  <span className="dim" style={{ fontSize: '.78rem', marginLeft: '.4rem' }}>
                    {p.siteName} · {p.registration}
                  </span>
                </span>
                <span style={{ fontWeight: 700, color: '#1e3a8a' }}>{fmtDate(p.expectedAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Big charts */}
      <div className="client-chart-grid">
        <Link to="/requests" className="card client-chart-card">
          <h3>{report.period.fy} Request Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <DonutChart slices={reqSlices} size={180} />
            <div style={{ flex: 1, minWidth: 120 }}>
              {reqSlices.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '.5rem',
                    marginBottom: '.5rem',
                    fontSize: '.88rem',
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span className="dim">{s.label}</span>
                  <span style={{ fontWeight: 800, marginLeft: 'auto', fontSize: '1.1rem' }}>{s.value}</span>
                </div>
              ))}
              <div className="dim" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
                Tap to view all requests →
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/impact"
          className="card client-chart-card"
          style={{ background: 'linear-gradient(135deg,#f0fdf4,#fff)', borderColor: '#86efac' }}
        >
          <h3 style={{ color: '#166534' }}>🌱 Sustainability · {report.period.fy}</h3>
          <BarChart bars={ecoBars} maxVal={ecoMax} />
          <div className="dim" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
            View full impact report →
          </div>
        </Link>
      </div>

      {/* Recent requests — compact */}
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Recent Activity</div>
          <div className="spacer" />
          <Link to="/requests" className="btn bs bsm">
            All requests →
          </Link>
        </div>
        {requests.length === 0 ? (
          <div className="empty">
            <div className="empty-t">No requests yet</div>
            <Link to="/requests/new" className="btn bp" style={{ marginTop: '.6rem' }}>
              + New Request
            </Link>
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 5).map((s) => (
                  <tr key={s.id} className="click" onClick={() => nav(`/requests/${s.id}`)}>
                    <td>
                      <Link to={`/requests/${s.id}`} onClick={(e) => e.stopPropagation()}>
                        <b>{s.id}</b>
                      </Link>
                      <div className="dim" style={{ fontSize: '.72rem' }}>
                        {fmtDate(s.requestDate)}
                      </div>
                    </td>
                    <td className="dim">{s.siteName}</td>
                    <td>
                      {s.returned ? (
                        <span className="badge bg-am">Pending with You</span>
                      ) : (
                        <StageBadge stage={s.stage} />
                      )}
                    </td>
                    <td className="mono">{num(s.netKg > 0 ? s.netKg : s.approxWeight)} kg</td>
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

export function DashboardPage({ user }: DashboardPageProps) {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [error, setError] = useState('');
  const [siteId, setSiteId] = useState('');

  useEffect(() => {
    dataApi
      .reportsDashboard(siteId || undefined)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, [siteId]);

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      {!report ? (
        <p className="muted">Loading reports…</p>
      ) : report.kind === 'staff' ? (
        <AdminDashboard
          user={user}
          report={report}
          variant={user.role === 'factory' ? 'factory' : 'admin'}
        />
      ) : (
        <ClientDashboard user={user} report={report} siteId={siteId} onSite={setSiteId} />
      )}
    </div>
  );
}
