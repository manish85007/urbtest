import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '@urb-tectrack/shared';
import {
  dataApi,
  type ClientDashboardReport,
  type SessionUser,
  type StaffDashboardReport,
} from '../api';
import { StageBadge } from '../components/StageProgress';
import { fmtDate, num } from '../lib/format';
import { dashboardTitle } from '../lib/roles';

interface DashboardPageProps {
  user: SessionUser;
}

function StaffDashboard({
  user,
  report,
}: {
  user: SessionUser;
  report: StaffDashboardReport;
}) {
  const nav = useNavigate();
  const overdueTotal = report.overdue.reduce((s, r) => s + BigInt(r.outstandingPaise), 0n);
  const fy = report.stats.fyLabel || 'FY';
  const cap = report.stats.capacity;
  const open = report.activeRequests;

  return (
    <>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">{dashboardTitle(user.role)}</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {fy} · {user.name}
            {user.role === 'factory' && (user.factoryIds ?? []).length
              ? ` · ${(user.factoryIds ?? []).join(', ')}`
              : ''}
          </div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: '1rem' }}>
        <Link to="/requests?stage=1" className="stat">
          <div className="stat-l">New Requests</div>
          <div className="stat-v" style={{ color: report.stats.newRequests ? 'var(--am)' : 'var(--g2)' }}>
            {report.stats.newRequests}
          </div>
          <div className="stat-t">awaiting acknowledgement</div>
        </Link>
        <Link to="/requests" className="stat">
          <div className="stat-l">Open Requests</div>
          <div className="stat-v">{report.stats.openRequests}</div>
          <div className="stat-t">of {report.stats.totalRequests} total</div>
        </Link>
        <Link to="/reports?type=summary" className="stat">
          <div className="stat-l">Net Weight {fy}</div>
          <div className="stat-v">{num(report.stats.fyNetKg)}</div>
          <div className="stat-t">kg weighed</div>
        </Link>
        <Link to="/capacity" className="stat">
          <div className="stat-l">Capacity Used</div>
          <div className="stat-v">{cap.pct.toFixed(2)}%</div>
          <div className="stat-t">of {num(cap.capTpa)} TPA</div>
        </Link>
        <Link to="/reports?type=invoices" className="stat">
          <div className="stat-l">Payments Pending</div>
          <div className="stat-v" style={{ color: report.stats.pendingPayments ? 'var(--am)' : 'var(--g2)' }}>
            {report.stats.pendingPayments}
          </div>
          <div className="stat-t">invoices</div>
        </Link>
      </div>

      <div className="detail-grid">
        <div>
          {report.newRequests.length > 0 ? (
            <div className="card" style={{ background: 'var(--am2)', borderColor: '#fcd34d' }}>
              <div className="card-hd">
                <div className="card-ttl" style={{ color: 'var(--am)' }}>
                  ⏳ Awaiting Acknowledgement
                </div>
                <span className="badge bg-am">{report.newRequests.length}</span>
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Client</th>
                      <th>Approx</th>
                      <th>Raised</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.newRequests.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <b>{r.id}</b>
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {r.ref || ''}
                          </div>
                        </td>
                        <td>
                          {r.clientName}
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {r.siteName}
                          </div>
                        </td>
                        <td className="mono">
                          {r.approxWeight} kg
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {r.approxQty} units
                          </div>
                        </td>
                        <td className="dim">{fmtDate(r.requestDate)}</td>
                        <td>
                          <Link to={`/requests/${r.id}`} className="btn bp bsm">
                            {user.role === 'admin' ? 'Acknowledge' : 'Open'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Active Requests</div>
              <div className="spacer" />
              <Link to="/requests" className="btn bs bsm">
                View all →
              </Link>
            </div>
            {open.length === 0 ? (
              <div className="empty">
                <div className="empty-t">All caught up</div>
                <div style={{ fontSize: '.85rem' }}>No open requests</div>
              </div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Client</th>
                      <th>Stage</th>
                      <th>Invoices</th>
                      <th>Net kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.slice(0, 12).map((s) => (
                      <tr key={s.id} className="click" onClick={() => nav(`/requests/${s.id}`)}>
                        <td>
                          <Link to={`/requests/${s.id}`} onClick={(e) => e.stopPropagation()}>
                            <b>{s.id}</b>
                          </Link>
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {fmtDate(s.requestDate)}
                          </div>
                        </td>
                        <td>
                          {s.clientName}
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {s.siteName}
                          </div>
                        </td>
                        <td>
                          <StageBadge stage={s.stage} />
                        </td>
                        <td>
                          {s.invoices.length ? (
                            s.invoices.map((inv) => (
                              <span
                                key={inv.invoiceNo}
                                className={`badge ${inv.stage >= 9 ? 'bg-g' : 'bg-bl'}`}
                                style={{ margin: 1 }}
                              >
                                {inv.invoiceNo}
                              </span>
                            ))
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                        <td className="mono">{num(s.netKg > 0 ? s.netKg : s.approxWeight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          {report.overdue.length > 0 ? (
            <div className="card" style={{ background: 'var(--rd2)', borderColor: '#fecaca', marginBottom: '.6rem' }}>
              <div className="card-hd">
                <div className="card-ttl" style={{ color: 'var(--rd)' }}>
                  💰 Payments Overdue
                </div>
                <span className="badge bg-rd">{report.overdue.length}</span>
                <div className="spacer" />
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--rd)' }}>
                  {formatINR(Number(overdueTotal))}
                </span>
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Outstanding</th>
                      <th>Overdue</th>
                      <th>Reminders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.overdue.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo} className="click" onClick={() => nav(`/requests/${r.submissionId}`)}>
                        <td>
                          <Link to={`/requests/${r.submissionId}`} onClick={(e) => e.stopPropagation()}>
                            <b className="mono">{r.invoiceNo}</b>
                          </Link>
                          <div className="dim" style={{ fontSize: '.7rem' }}>
                            {r.submissionId}
                          </div>
                        </td>
                        <td className="dim">
                          {r.clientName}
                          {r.paymentTerms ? (
                            <div className="dim" style={{ fontSize: '.7rem' }}>
                              {r.paymentTerms}
                            </div>
                          ) : null}
                        </td>
                        <td className="mono">{formatINR(Number(r.outstandingPaise))}</td>
                        <td>
                          <span className="badge bg-rd">{r.overdueDays}d</span>
                        </td>
                        <td className="mono dim">{r.reminders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.overdue.length > 6 ? (
                <div className="dim" style={{ fontSize: '.72rem', marginTop: '.3rem' }}>
                  +{report.overdue.length - 6} more
                </div>
              ) : null}
              <div className="dim" style={{ fontSize: '.73rem', marginTop: '.35rem' }}>
                Reminders go out daily until the invoice is settled. A request cannot be closed while payment is
                outstanding.
              </div>
            </div>
          ) : null}

          {report.slaAtRisk.length > 0 ? (
            <div className="card" style={{ background: 'var(--am2)', borderColor: '#fcd34d', marginBottom: '.6rem' }}>
              <div className="card-hd">
                <div className="card-ttl" style={{ color: 'var(--am)' }}>
                  ⏱️ Recycling SLA at Risk
                </div>
                <span className="badge bg-am">{report.slaAtRisk.length}</span>
                <div className="spacer" />
                <span className="dim" style={{ fontSize: '.75rem' }}>
                  {report.slaAtRisk[0]?.slaDays ?? 30}-day target
                </span>
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Received</th>
                      <th>Elapsed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.slaAtRisk.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo} className="click" onClick={() => nav(`/requests/${r.submissionId}`)}>
                        <td>
                          <Link to={`/requests/${r.submissionId}`} onClick={(e) => e.stopPropagation()}>
                            <b className="mono">{r.invoiceNo}</b>
                          </Link>
                          <div className="dim" style={{ fontSize: '.7rem' }}>
                            {r.submissionId}
                          </div>
                        </td>
                        <td className="dim">{r.clientName}</td>
                        <td className="dim">{fmtDate(r.receivedDate)}</td>
                        <td className="mono">
                          {r.daysUsed} / {r.slaDays}
                        </td>
                        <td>
                          <span className="badge bg-am">{r.stateLabel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dim" style={{ fontSize: '.73rem', marginTop: '.35rem' }}>
                Measured from receipt of material at the facility to issue of the Certificate of Destruction.
              </div>
            </div>
          ) : null}

          <WorkQueue title="📋 Awaiting MRN" items={report.queues.awaitingMrn} act="Receive" cls="bg-am" />
          <WorkQueue title="♻️ Awaiting Recycling" items={report.queues.awaitingRecycling} act="Process" cls="bg-bl" />
          {user.role === 'admin' ? (
            <WorkQueue title="🏅 Awaiting CoD" items={report.queues.awaitingCod} act="Upload" cls="bg-pu" />
          ) : null}
          {user.role === 'admin' ? (
            <WorkQueue title="🎉 Awaiting Client Close" items={report.queues.awaitingClose} act="With client" cls="bg-g" />
          ) : null}
        </div>
      </div>
    </>
  );
}

function WorkQueue({
  title,
  items,
  act,
  cls,
}: {
  title: string;
  items: StaffDashboardReport['queues']['awaitingMrn'];
  act: string;
  cls: string;
}) {
  const nav = useNavigate();
  return (
    <div className="card" style={{ marginBottom: '.6rem' }}>
      <div className="card-hd">
        <div className="card-ttl">{title}</div>
        <span className={`badge ${cls}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="dim" style={{ fontSize: '.82rem', padding: '.3rem 0' }}>
          Nothing pending
        </div>
      ) : (
        <>
          <div className="tw">
            <table>
              <tbody>
                {items.slice(0, 6).map((item) => (
                  <tr
                    key={item.invoiceId}
                    className="click"
                    onClick={() => nav(`/requests/${item.submissionId}`)}
                  >
                    <td>
                      <Link to={`/requests/${item.submissionId}`} onClick={(e) => e.stopPropagation()}>
                        <b>{item.invoiceNo}</b>
                      </Link>
                      <div className="dim" style={{ fontSize: '.72rem' }}>
                        {item.submissionId} · {item.clientName}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge bg-gy">{act}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 6 ? (
            <div className="dim" style={{ fontSize: '.72rem', marginTop: '.3rem' }}>
              +{items.length - 6} more
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Animate a number counting up when value changes. */
function useAnimatedNumber(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setDisplay(Math.round(value * p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return display;
}

/** Animated SVG donut chart. */
function DonutChart({
  slices,
  size = 180,
}: {
  slices: Array<{ value: number; color: string; label: string }>;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 38;
  const cx = 50;
  const cy = 50;
  let startAngle = -Math.PI / 2;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="client-chart-pie-wrap">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
          No data
        </text>
      </svg>
    );
  }

  const paths = slices.map((sl) => {
    const pct = sl.value / total;
    const sweep = 2 * Math.PI * pct;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { d, color: sl.color, label: sl.label, pct, value: sl.value };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="client-chart-pie-wrap">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.92}>
          <title>
            {p.label}: {p.value} ({(p.pct * 100).toFixed(0)}%)
          </title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={22} fill="white" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#27500A">
        {total}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="5.5" fill="#7d857a">
        total
      </text>
    </svg>
  );
}

/** Animated horizontal bar chart for sustainability metrics. */
function EcoBarChart({
  bars,
  maxVal,
}: {
  bars: Array<{ label: string; value: number; color: string; unit?: string }>;
  maxVal: number;
}) {
  if (bars.length === 0) return null;
  const barH = 28;
  const gap = 10;

  return (
    <div style={{ width: '100%' }}>
      {bars.map((b, i) => {
        const pct = maxVal > 0 ? (b.value / maxVal) * 100 : 0;
        return (
          <div key={i} className="client-chart-bar" style={{ marginBottom: gap }}>
            <div style={{ fontSize: '.78rem', color: 'var(--mu)', marginBottom: '.25rem', fontWeight: 600 }}>
              {b.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <div
                style={{
                  flex: 1,
                  height: barH,
                  background: '#f3f4f6',
                  borderRadius: 7,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="client-chart-bar-fill"
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: b.color,
                    animationDelay: `${0.1 + i * 0.15}s`,
                  }}
                />
              </div>
              <div style={{ minWidth: 72, textAlign: 'right', fontWeight: 800, fontSize: '.95rem', color: '#1c1b18' }}>
                {num(b.value, b.unit === 'kg' ? 0 : 1)}
                {b.unit ? ` ${b.unit}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
        <Link to="/requests" className="client-quick-tile">
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
        <Link to="/requests" className="client-dash-metric">
          <div className="client-dash-metric-v" style={{ color: '#3b82f6' }}>
            {openCount}
          </div>
          <div className="client-dash-metric-l">Open Requests</div>
        </Link>
        <Link to="/requests?stage=9" className="client-dash-metric">
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
          <EcoBarChart bars={ecoBars} maxVal={ecoMax} />
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
  const [report, setReport] = useState<StaffDashboardReport | ClientDashboardReport | null>(null);
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
        <StaffDashboard user={user} report={report} />
      ) : (
        <ClientDashboard user={user} report={report} siteId={siteId} onSite={setSiteId} />
      )}
    </div>
  );
}
