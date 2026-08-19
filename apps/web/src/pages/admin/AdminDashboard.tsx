import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR } from '@urb-tectrack/shared';
import { type SessionUser, type StaffDashboardReport } from '../../api';
import { BarChart, CapacityRing, DonutChart } from '../../components/charts';
import { StageBadge } from '../../components/StageProgress';
import { fmtDate, num } from '../../lib/format';
import { useAnimatedNumber } from '../../lib/useAnimatedNumber';
import { dashboardTitle } from '../../lib/roles';

type ActionPanel = 'ack' | 'overdue' | 'sla' | 'queues' | 'active';

interface AdminDashboardProps {
  user: SessionUser;
  report: StaffDashboardReport;
  variant?: 'admin' | 'factory';
}

export function AdminDashboard({ user, report, variant = 'admin' }: AdminDashboardProps) {
  const isAdmin = variant === 'admin';
  const nav = useNavigate();
  const [panel, setPanel] = useState<ActionPanel>(() => {
    if (report.newRequests.length) return 'ack';
    if (report.overdue.length) return 'overdue';
    if (report.slaAtRisk.length) return 'sla';
    return 'active';
  });

  const fy = report.stats.fyLabel || 'FY';
  const cap = report.stats.capacity;
  const overdueTotal = report.overdue.reduce((s, r) => s + BigInt(r.outstandingPaise), 0n);

  const newCount = useAnimatedNumber(report.stats.newRequests);
  const openCount = useAnimatedNumber(report.stats.openRequests);
  const fyKg = useAnimatedNumber(Math.round(report.stats.fyNetKg));
  const pendingPay = useAnimatedNumber(report.stats.pendingPayments);

  const activeOther = Math.max(0, report.stats.openRequests - report.stats.newRequests);
  const closedCount = Math.max(0, report.stats.totalRequests - report.stats.openRequests);
  const reqSlices = [
    { value: report.stats.newRequests, color: '#f59e0b', label: 'Awaiting ack' },
    { value: activeOther, color: '#3b82f6', label: 'In progress' },
    { value: closedCount, color: '#22c55e', label: 'Closed / other' },
  ].filter((s) => s.value > 0);

  const queueBars = [
    { label: 'Awaiting MRN', value: report.queues.awaitingMrn.length, color: '#f59e0b' },
    { label: 'Awaiting Recycling', value: report.queues.awaitingRecycling.length, color: '#3b82f6' },
    ...(isAdmin
      ? [
          { label: 'Awaiting CoD', value: report.queues.awaitingCod.length, color: '#a855f7' },
          { label: 'Awaiting Client Close', value: report.queues.awaitingClose.length, color: '#22c55e' },
        ]
      : []),
  ];
  const queueMax = Math.max(...queueBars.map((b) => b.value), 1);

  const panels: Array<{ id: ActionPanel; label: string; count: number; alert?: boolean }> = [
    { id: 'ack', label: 'Awaiting ack', count: report.newRequests.length, alert: report.newRequests.length > 0 },
    { id: 'overdue', label: 'Overdue pay', count: report.overdue.length, alert: report.overdue.length > 0 },
    { id: 'sla', label: 'SLA at risk', count: report.slaAtRisk.length, alert: report.slaAtRisk.length > 0 },
    {
      id: 'queues',
      label: 'Work queues',
      count:
        report.queues.awaitingMrn.length +
        report.queues.awaitingRecycling.length +
        (isAdmin ? report.queues.awaitingCod.length + report.queues.awaitingClose.length : 0),
    },
    { id: 'active', label: 'Active requests', count: report.activeRequests.length },
  ];

  return (
    <div className="admin-dash">
      <div className="f-row admin-dash-hd">
        <div>
          <div className="h1">{dashboardTitle(user.role)}</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {fy} · {user.name}
            {!isAdmin && (user.factoryIds ?? []).length ? ` · ${(user.factoryIds ?? []).join(', ')}` : ''}
            {isAdmin ? ' · operations overview' : ''}
          </div>
        </div>
        <div className="spacer" />
        <Link to="/requests/new" className="btn bp">
          + New Request
        </Link>
      </div>

      <div className="admin-quick-grid">
        <Link to="/requests?stage=1" className="admin-quick-tile">
          <span className="admin-quick-ico">⏳</span>
          <span className="admin-quick-l">Acknowledge</span>
          <span className="admin-quick-s">{report.stats.newRequests} waiting</span>
        </Link>
        <Link to="/requests?status=open" className="admin-quick-tile">
          <span className="admin-quick-ico">📋</span>
          <span className="admin-quick-l">Open Requests</span>
          <span className="admin-quick-s">{report.stats.openRequests} active</span>
        </Link>
        <Link to="/heroes" className="admin-quick-tile">
          <span className="admin-quick-ico">🌳</span>
          <span className="admin-quick-l">Recycle Heroes</span>
          <span className="admin-quick-s">Tree ledger &amp; planting</span>
        </Link>
        <Link to="/reports" className="admin-quick-tile">
          <span className="admin-quick-ico">📊</span>
          <span className="admin-quick-l">Reports</span>
          <span className="admin-quick-s">Summary, invoices &amp; more</span>
        </Link>
        <Link to="/capacity" className="admin-quick-tile">
          <span className="admin-quick-ico">🏭</span>
          <span className="admin-quick-l">Capacity</span>
          <span className="admin-quick-s">{cap.pct.toFixed(1)}% of {num(cap.capTpa)} TPA</span>
        </Link>
        {isAdmin ? (
          <Link to="/masters" className="admin-quick-tile">
            <span className="admin-quick-ico">⚙️</span>
            <span className="admin-quick-l">Masters</span>
            <span className="admin-quick-s">Clients, users &amp; lookups</span>
          </Link>
        ) : null}
      </div>

      <div className="admin-dash-hero">
        <Link to="/requests?stage=1" className="admin-dash-metric alert-m">
          <div className="admin-dash-metric-v" style={{ color: report.stats.newRequests ? '#d97706' : 'var(--g2)' }}>
            {newCount}
          </div>
          <div className="admin-dash-metric-l">New Requests</div>
        </Link>
        <Link to="/requests?status=open" className="admin-dash-metric">
          <div className="admin-dash-metric-v" style={{ color: '#3b82f6' }}>
            {openCount}
          </div>
          <div className="admin-dash-metric-l">Open · {report.stats.totalRequests} total</div>
        </Link>
        <Link to="/reports?type=summary" className="admin-dash-metric">
          <div className="admin-dash-metric-v">{num(fyKg)}</div>
          <div className="admin-dash-metric-l">Net kg · {fy}</div>
        </Link>
        <Link to="/reports?type=invoices" className="admin-dash-metric">
          <div className="admin-dash-metric-v" style={{ color: report.stats.pendingPayments ? '#dc2626' : 'var(--g2)' }}>
            {pendingPay}
          </div>
          <div className="admin-dash-metric-l">Payments pending</div>
        </Link>
      </div>

      <div className="admin-chart-grid">
        <div className="card admin-chart-card">
          <h3>Request pipeline</h3>
          <div className="admin-chart-row">
            <DonutChart slices={reqSlices.length ? reqSlices : [{ value: 1, color: '#e5e7eb', label: 'Empty' }]} size={160} centerLabel="requests" />
            <div className="admin-chart-legend">
              {reqSlices.map((s) => (
                <div key={s.label} className="admin-legend-row">
                  <span className="admin-legend-dot" style={{ background: s.color }} />
                  <span className="dim">{s.label}</span>
                  <span className="admin-legend-v">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card admin-chart-card">
          <h3>Work queues</h3>
          <BarChart bars={queueBars} maxVal={queueMax} />
        </div>

        <Link to="/capacity" className="card admin-chart-card admin-cap-card">
          <h3>Facility capacity</h3>
          <div className="admin-cap-wrap">
            <CapacityRing pct={cap.pct} size={130} />
            <div>
              <div className="admin-cap-stat">
                <span className="admin-cap-v">{num(cap.capTpa)}</span>
                <span className="admin-cap-l">TPA licensed</span>
              </div>
              <div className="dim" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
                Tap to view capacity detail →
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="admin-action-center">
        <div className="admin-panel-chips">
          {panels.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`admin-panel-chip${panel === p.id ? ' on' : ''}${p.alert ? ' alert' : ''}`}
              onClick={() => setPanel(p.id)}
            >
              {p.label}
              <span className="admin-panel-n">{p.count}</span>
            </button>
          ))}
        </div>

        {panel === 'ack' && report.newRequests.length > 0 ? (
          <div className="card admin-action-card alert-card">
            <div className="card-hd">
              <div className="card-ttl">⏳ Awaiting Acknowledgement</div>
              <span className="badge bg-am">{report.newRequests.length}</span>
            </div>
            <AdminTable
              rows={report.newRequests.map((r) => ({
                key: r.id,
                onClick: () => nav(`/requests/${r.id}`),
                cells: [
                  <>
                    <b>{r.id}</b>
                    <div className="dim" style={{ fontSize: '.72rem' }}>{r.ref || ''}</div>
                  </>,
                  <>
                    {r.clientName}
                    <div className="dim" style={{ fontSize: '.72rem' }}>{r.siteName}</div>
                  </>,
                  <span className="mono">{r.approxWeight} kg</span>,
                  <span className="dim">{fmtDate(r.requestDate)}</span>,
                  <Link to={`/requests/${r.id}`} className="btn bp bsm" onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? 'Acknowledge' : 'Open'}
                  </Link>,
                ],
              }))}
              headers={['Request', 'Client', 'Approx', 'Raised', '']}
            />
          </div>
        ) : null}

        {panel === 'overdue' && report.overdue.length > 0 ? (
          <div className="card admin-action-card danger-card">
            <div className="card-hd">
              <div className="card-ttl">💰 Payments Overdue</div>
              <span className="badge bg-rd">{report.overdue.length}</span>
              <div className="spacer" />
              <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--rd)' }}>
                {formatINR(Number(overdueTotal))}
              </span>
            </div>
            <AdminTable
              rows={report.overdue.slice(0, 8).map((r) => ({
                key: r.invoiceNo,
                onClick: () => nav(`/requests/${r.submissionId}`),
                cells: [
                  <>
                    <b className="mono">{r.invoiceNo}</b>
                    <div className="dim" style={{ fontSize: '.7rem' }}>{r.submissionId}</div>
                  </>,
                  <span className="dim">{r.clientName}</span>,
                  <span className="mono">{formatINR(Number(r.outstandingPaise))}</span>,
                  <span className="badge bg-rd">{r.overdueDays}d</span>,
                ],
              }))}
              headers={['Invoice', 'Client', 'Outstanding', 'Overdue']}
            />
          </div>
        ) : null}

        {panel === 'sla' && report.slaAtRisk.length > 0 ? (
          <div className="card admin-action-card warn-card">
            <div className="card-hd">
              <div className="card-ttl">⏱️ Recycling SLA at Risk</div>
              <span className="badge bg-am">{report.slaAtRisk.length}</span>
            </div>
            <AdminTable
              rows={report.slaAtRisk.slice(0, 8).map((r) => ({
                key: r.invoiceNo,
                onClick: () => nav(`/requests/${r.submissionId}`),
                cells: [
                  <>
                    <b className="mono">{r.invoiceNo}</b>
                    <div className="dim" style={{ fontSize: '.7rem' }}>{r.submissionId}</div>
                  </>,
                  <span className="dim">{r.clientName}</span>,
                  <span className="mono">{r.daysUsed} / {r.slaDays}</span>,
                  <span className="badge bg-am">{r.stateLabel}</span>,
                ],
              }))}
              headers={['Invoice', 'Client', 'Elapsed', 'Status']}
            />
          </div>
        ) : null}

        {panel === 'queues' ? (
          <div className="admin-queue-grid">
            <AdminQueueCard title="📋 Awaiting MRN" items={report.queues.awaitingMrn} act="Receive" cls="bg-am" />
            <AdminQueueCard title="♻️ Awaiting Recycling" items={report.queues.awaitingRecycling} act="Process" cls="bg-bl" />
            {isAdmin ? (
              <>
                <AdminQueueCard title="🏅 Awaiting CoD" items={report.queues.awaitingCod} act="Upload" cls="bg-pu" />
                <AdminQueueCard title="🎉 Awaiting Client Close" items={report.queues.awaitingClose} act="With client" cls="bg-g" />
              </>
            ) : null}
          </div>
        ) : null}

        {panel === 'active' ? (
          <div className="card admin-action-card">
            <div className="card-hd">
              <div className="card-ttl">Active Requests</div>
              <div className="spacer" />
              <Link to="/requests" className="btn bs bsm">View all →</Link>
            </div>
            {report.activeRequests.length === 0 ? (
              <div className="empty">
                <div className="empty-t">All caught up</div>
                <div style={{ fontSize: '.85rem' }}>No open requests</div>
              </div>
            ) : (
              <AdminTable
                rows={report.activeRequests.slice(0, 12).map((s) => ({
                  key: s.id,
                  onClick: () => nav(`/requests/${s.id}`),
                  cells: [
                    <>
                      <Link to={`/requests/${s.id}`} onClick={(e) => e.stopPropagation()}><b>{s.id}</b></Link>
                      <div className="dim" style={{ fontSize: '.72rem' }}>{fmtDate(s.requestDate)}</div>
                    </>,
                    <>
                      {s.clientName}
                      <div className="dim" style={{ fontSize: '.72rem' }}>{s.siteName}</div>
                    </>,
                    <StageBadge stage={s.stage} />,
                    <>
                      {s.invoices.length
                        ? s.invoices.map((inv) => (
                            <span key={inv.invoiceNo} className={`badge ${inv.stage >= 9 ? 'bg-g' : 'bg-bl'}`} style={{ margin: 1 }}>
                              {inv.invoiceNo}
                            </span>
                          ))
                        : <span className="dim">—</span>}
                    </>,
                    <span className="mono">{num(s.netKg > 0 ? s.netKg : s.approxWeight)}</span>,
                  ],
                }))}
                headers={['Request', 'Client', 'Stage', 'Invoices', 'Net kg']}
              />
            )}
          </div>
        ) : null}

        {panel === 'ack' && !report.newRequests.length ? (
          <div className="card admin-action-card"><div className="dim" style={{ padding: '.5rem 0' }}>No requests awaiting acknowledgement.</div></div>
        ) : null}
        {panel === 'overdue' && !report.overdue.length ? (
          <div className="card admin-action-card"><div className="dim" style={{ padding: '.5rem 0' }}>No overdue payments.</div></div>
        ) : null}
        {panel === 'sla' && !report.slaAtRisk.length ? (
          <div className="card admin-action-card"><div className="dim" style={{ padding: '.5rem 0' }}>No invoices at SLA risk.</div></div>
        ) : null}
      </div>
    </div>
  );
}

function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<{ key: string; onClick: () => void; cells: ReactNode[] }>;
}) {
  return (
    <div className="tw admin-table-wrap">
      <table>
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className="click admin-table-row" style={{ animationDelay: `${i * 0.04}s` }} onClick={r.onClick}>
              {r.cells.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminQueueCard({
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
    <div className="card admin-queue-card">
      <div className="card-hd">
        <div className="card-ttl">{title}</div>
        <span className={`badge ${cls}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="dim" style={{ fontSize: '.82rem', padding: '.3rem 0' }}>Nothing pending</div>
      ) : (
        <div className="admin-queue-list">
          {items.slice(0, 5).map((item, i) => (
            <button
              key={item.invoiceId}
              type="button"
              className="admin-queue-item"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => nav(`/requests/${item.submissionId}`)}
            >
              <span>
                <b>{item.invoiceNo}</b>
                <span className="dim" style={{ fontSize: '.72rem', marginLeft: '.35rem' }}>
                  {item.submissionId} · {item.clientName}
                </span>
              </span>
              <span className="badge bg-gy">{act}</span>
            </button>
          ))}
          {items.length > 5 ? <div className="dim" style={{ fontSize: '.72rem' }}>+{items.length - 5} more</div> : null}
        </div>
      )}
    </div>
  );
}
