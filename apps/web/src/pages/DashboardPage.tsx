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
          <div className="h1">{user.role === 'factory' ? 'Factory Dashboard' : 'Operations Dashboard'}</div>
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

/** Tiny SVG donut/pie chart — no external lib needed. */
function PieChart({
  slices,
  size = 100,
}: {
  slices: Array<{ value: number; color: string; label: string }>;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#e5e7eb" strokeWidth="20" />
      </svg>
    );
  }
  const r = 38;
  const cx = 50;
  const cy = 50;
  let startAngle = -Math.PI / 2;
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
    return { d, color: sl.color, label: sl.label, pct };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color}>
          <title>
            {p.label}: {(p.pct * 100).toFixed(1)}%
          </title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={16} fill="white" />
    </svg>
  );
}

/** Simple horizontal bar chart. */
function BarChart({
  bars,
  maxVal,
}: {
  bars: Array<{ label: string; value: number; color: string }>;
  maxVal: number;
}) {
  if (bars.length === 0) return null;
  const barH = 20;
  const gap = 6;
  const labelW = 70;
  const chartW = 180;
  const height = bars.length * (barH + gap) - gap;

  return (
    <svg width={labelW + chartW + 50} height={height} style={{ overflow: 'visible' }}>
      {bars.map((b, i) => {
        const y = i * (barH + gap);
        const w = maxVal > 0 ? (b.value / maxVal) * chartW : 0;
        return (
          <g key={i}>
            <text x={labelW - 4} y={y + barH / 2 + 4} textAnchor="end" fontSize={10} fill="#6b7280">
              {b.label}
            </text>
            <rect x={labelW} y={y} width={w} height={barH} rx={3} fill={b.color} />
            <text x={labelW + w + 4} y={y + barH / 2 + 4} fontSize={10} fill="#374151">
              {num(b.value)}
            </text>
          </g>
        );
      })}
    </svg>
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

  // Pie chart: open vs closed requests
  const reqSlices = [
    { value: report.counts.open, color: '#3b82f6', label: 'Open' },
    { value: report.counts.closed, color: '#22c55e', label: 'Completed' },
  ];

  // Sustainability bar chart (YTD)
  const ecoMax = Math.max(impact.kg, impact.co2, 1);
  const ecoBars = [
    { label: `Recycled (kg)`, value: impact.kg, color: '#22c55e' },
    { label: `CO₂ Avoided (kg)`, value: impact.co2, color: '#3b82f6' },
    { label: `Landfill Saved (kg)`, value: impact.landfill, color: '#f59e0b' },
  ];

  return (
    <>
      {/* Header */}
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">Welcome, {first}</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {report.clientName || user.name} · {report.period.fy}
            {siteName ? ` · ${siteName}` : ' · all sites'}
          </div>
        </div>
        <div className="spacer" />
        {siteId ? (
          <button type="button" className="btn bs" onClick={() => onSite('')}>
            Clear site filter
          </button>
        ) : null}
        <Link to="/requests/new" className="btn bp">
          + New Request
        </Link>
      </div>

      {/* Action alert: certificates ready */}
      {report.pendingClose.length > 0 ? (
        <div className="card" style={{ background: 'var(--g3)', borderColor: 'var(--g4)', marginBottom: '.8rem' }}>
          <div className="card-hd">
            <div className="card-ttl">🏅 Certificates ready for your review</div>
            <span className="badge bg-g">{report.pendingClose.length}</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Invoice</th>
                  <th>Certificate(s)</th>
                  <th>Issued</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.pendingClose.map((p) => (
                  <tr key={p.invoiceNo}>
                    <td>
                      <Link to={`/requests/${p.submissionId}`}>
                        <b>{p.submissionId}</b>
                      </Link>
                    </td>
                    <td className="mono">{p.invoiceNo}</td>
                    <td className="mono">{p.certificates.join(', ')}</td>
                    <td className="dim">{p.issuedAt ? fmtDate(p.issuedAt) : '—'}</td>
                    <td>
                      <Link to={`/requests/${p.submissionId}`} className="btn bp bsm">
                        Review &amp; Close
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Summary cards — 2 charts + key stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '.7rem',
          marginBottom: '1rem',
        }}
      >
        {/* Requests pie */}
        <Link to="/requests" className="card" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <PieChart slices={reqSlices} size={80} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--g2)', marginBottom: '.3rem' }}>
              {report.period.fy} Requests
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
              {reqSlices.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem' }}>
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }}
                  />
                  <span className="dim">{s.label}</span>
                  <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Link>

        {/* Sustainability bar chart */}
        <Link to="/impact" className="card" style={{ textDecoration: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#166534', marginBottom: '.5rem' }}>
            🌱 Sustainability {report.period.fy}
          </div>
          <BarChart bars={ecoBars} maxVal={ecoMax} />
        </Link>

        {/* Trees / milestone */}
        <Link
          to="/heroes"
          className="card"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
            borderColor: '#86efac',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '.25rem',
          }}
        >
          <div style={{ fontSize: '2rem' }}>🌳</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#14532d', lineHeight: 1 }}>
            {report.treesPlanted}
          </div>
          <div style={{ fontSize: '.78rem', color: '#166534', fontWeight: 600 }}>trees planted</div>
          <div className="dim" style={{ fontSize: '.7rem' }}>
            {num(report.lifetimeTonnes)} t recycled lifetime
          </div>
        </Link>
      </div>

      {/* Main content grid */}
      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Recent Requests</div>
              <div className="spacer" />
              <Link to="/requests" className="btn bs bsm">
                View all →
              </Link>
            </div>
            {requests.length === 0 ? (
              <div className="empty">
                <div className="empty-t">No requests yet</div>
                <div style={{ fontSize: '.85rem', marginBottom: '.7rem' }}>
                  Raise your first e-waste collection request
                </div>
                <Link to="/requests/new" className="btn bp">
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
                    {requests.slice(0, 8).map((s) => (
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
                            <span className="badge bg-am" title="Returned — please update and resubmit">
                              Pending with You
                            </span>
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

        {/* Right column: sites compact list */}
        <div>
          {report.sites.length > 1 ? (
            <div className="card" style={{ marginBottom: '.6rem' }}>
              <div className="card-hd">
                <div className="card-ttl">Your Sites</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {report.sites.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: siteId === st.id ? 'var(--g3)' : 'transparent',
                      border: '1px solid',
                      borderColor: siteId === st.id ? 'var(--g)' : 'var(--bdr)',
                      borderRadius: 7,
                      padding: '.4rem .6rem',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onClick={() => onSite(siteId === st.id ? '' : st.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{st.name}</div>
                      <div className="dim" style={{ fontSize: '.72rem' }}>
                        {st.open} open · {num(st.fyKg)} kg {report.period.fy}
                      </div>
                    </div>
                    {siteId === st.id ? (
                      <span className="badge bg-g" style={{ flexShrink: 0 }}>
                        Filtered
                      </span>
                    ) : (
                      <span className="dim" style={{ fontSize: '.8rem' }}>
                        →
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Next pickup callout if exists */}
          {report.sites.some((s) => s.nextPickup) ? (
            <div className="card" style={{ marginBottom: '.6rem', borderColor: '#93c5fd', background: '#eff6ff' }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#1e40af', marginBottom: '.25rem' }}>
                📅 Next Pickup
              </div>
              {report.sites
                .filter((s) => s.nextPickup)
                .slice(0, 3)
                .map((s) => (
                  <div key={s.id} style={{ fontSize: '.82rem', color: '#1e3a8a' }}>
                    {s.name}: <b>{fmtDate(s.nextPickup!)}</b>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
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
