import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR } from '@urb-tectrack/shared';
import {
  dataApi,
  type ClientDashboardReport,
  type SessionUser,
  type StaffDashboardReport,
  type SubmissionSummary,
} from '../api';
import { StageBadge } from '../components/StageProgress';

interface DashboardPageProps {
  user: SessionUser;
}

function StaffDashboard({
  user,
  report,
  subs,
}: {
  user: SessionUser;
  report: StaffDashboardReport;
  subs: SubmissionSummary[];
}) {
  const overdueTotal = report.overdue.reduce((s, r) => s + BigInt(r.outstandingPaise), 0n);
  const fy = report.stats.fyLabel || 'FY';

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

      <div className="stats">
        <div className="stat">
          <div className="stat-l">New Requests</div>
          <div className="stat-v" style={{ color: report.stats.newRequests ? 'var(--am)' : 'var(--g2)' }}>
            {report.stats.newRequests}
          </div>
          <div className="stat-t">awaiting acknowledgement</div>
        </div>
        <div className="stat">
          <div className="stat-l">Open Requests</div>
          <div className="stat-v">{report.stats.openRequests}</div>
          <div className="stat-t">in progress</div>
        </div>
        <div className="stat">
          <div className="stat-l">Net Weight {fy}</div>
          <div className="stat-v">{report.stats.fyNetKg.toLocaleString()}</div>
          <div className="stat-t">kg weighed</div>
        </div>
        <div className="stat">
          <div className="stat-l">Payments Pending</div>
          <div className="stat-v" style={{ color: report.stats.pendingPayments ? 'var(--am)' : 'var(--g2)' }}>
            {report.stats.pendingPayments}
          </div>
          <div className="stat-t">invoices</div>
        </div>
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
                        <td className="dim">{r.requestDate.slice(0, 10)}</td>
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
            {subs.length === 0 ? (
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
                    {subs.slice(0, 12).map((s) => (
                      <tr key={s.id} className="click">
                        <td>
                          <Link to={`/requests/${s.id}`}>
                            <b>{s.id}</b>
                          </Link>
                          <div className="dim" style={{ fontSize: '.72rem' }}>
                            {s.requestDate.slice(0, 10)}
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
                          {s.invoiceCount ? (
                            <span className="badge bg-bl">{s.invoiceCount}</span>
                          ) : (
                            <span className="dim">—</span>
                          )}
                        </td>
                        <td className="mono">{s.approxWeight}</td>
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
                    </tr>
                  </thead>
                  <tbody>
                    {report.overdue.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo} className="click">
                        <td>
                          <Link to={`/requests/${r.submissionId}`}>
                            <b className="mono">{r.invoiceNo}</b>
                          </Link>
                          <div className="dim" style={{ fontSize: '.7rem' }}>
                            {r.submissionId}
                          </div>
                        </td>
                        <td className="dim">{r.clientName}</td>
                        <td className="mono">{formatINR(Number(r.outstandingPaise))}</td>
                        <td>
                          <span className="badge bg-rd">{r.overdueDays}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Elapsed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.slaAtRisk.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo}>
                        <td>
                          <Link to={`/requests/${r.submissionId}`}>
                            <b className="mono">{r.invoiceNo}</b>
                          </Link>
                        </td>
                        <td className="dim">{r.clientName}</td>
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
        <div className="tw">
          <table>
            <tbody>
              {items.slice(0, 6).map((item) => (
                <tr key={item.invoiceId} className="click">
                  <td>
                    <Link to={`/requests/${item.submissionId}`}>
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
      )}
    </div>
  );
}

function ClientDashboard({
  user,
  report,
  subs,
}: {
  user: SessionUser;
  report: ClientDashboardReport;
  subs: SubmissionSummary[];
}) {
  const first = user.name.split(' ')[0];
  const { impact } = report;

  return (
    <>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">Welcome, {first}</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {report.period.fy} · all sites
          </div>
        </div>
        <div className="spacer" />
        <Link to="/requests/new" className="btn bp">
          + New Request
        </Link>
      </div>

      {report.pendingClose.length > 0 ? (
        <div className="card" style={{ background: 'var(--g3)', borderColor: 'var(--g4)' }}>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.pendingClose.map((p) => (
                  <tr key={p.invoiceNo}>
                    <td>
                      <b>{p.submissionId}</b>
                    </td>
                    <td className="mono">{p.invoiceNo}</td>
                    <td className="mono">{p.certificates.join(', ')}</td>
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

      <div className="stats">
        <div className="stat">
          <div className="stat-l">Open Requests</div>
          <div className="stat-v">{subs.filter((s) => s.stage < 9).length}</div>
          <div className="stat-t">in progress</div>
        </div>
        <div className="stat">
          <div className="stat-l">Completed</div>
          <div className="stat-v">{subs.filter((s) => s.stage >= 9).length}</div>
          <div className="stat-t">lifecycle closed</div>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg,#dcfce7,#f0fdf4)', borderColor: '#86efac' }}>
          <div className="stat-l" style={{ color: '#166534' }}>
            Recycled {report.period.fy}
          </div>
          <div className="stat-v" style={{ color: '#14532d' }}>
            {impact.kg.toLocaleString()}
          </div>
          <div className="stat-t">kg</div>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg,#dbeafe,#eff6ff)', borderColor: '#93c5fd' }}>
          <div className="stat-l" style={{ color: '#1e40af' }}>
            CO₂ Avoided
          </div>
          <div className="stat-v" style={{ color: '#1e3a8a' }}>
            {impact.co2.toFixed(0)}
          </div>
          <div className="stat-t">kg CO₂e</div>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg,#fef9c3,#fefce8)', borderColor: '#fde047' }}>
          <div className="stat-l" style={{ color: '#854d0e' }}>
            Trees Planted
          </div>
          <div className="stat-v" style={{ color: '#713f12' }}>
            {report.treesEarned}
          </div>
          <div className="stat-t">lifetime</div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Your Requests</div>
              <div className="spacer" />
              <Link to="/requests" className="btn bs bsm">
                View all →
              </Link>
            </div>
            {subs.length === 0 ? (
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
                      <th>Stage</th>
                      <th>Weight</th>
                      <th>Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.slice(0, 12).map((s) => (
                      <tr key={s.id} className="click">
                        <td>
                          <Link to={`/requests/${s.id}`}>
                            <b>{s.id}</b>
                          </Link>
                        </td>
                        <td className="dim">{s.siteName}</td>
                        <td>
                          <StageBadge stage={s.stage} />
                        </td>
                        <td className="mono">{s.approxWeight} kg</td>
                        <td className="dim">{s.requestDate.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="card" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderColor: '#86efac' }}>
            <div className="card-ttl" style={{ color: '#166534', marginBottom: '.5rem' }}>
              🌳 Recycle Heroes
            </div>
            <div style={{ textAlign: 'center', padding: '.4rem 0' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#14532d' }}>{report.treesEarned}</div>
              <div style={{ fontSize: '.78rem', color: '#166534', fontWeight: 600 }}>trees planted on your behalf</div>
              <div className="dim" style={{ fontSize: '.72rem', marginTop: '.3rem' }}>
                {impact.tonnes.toFixed(2)} tonnes recycled
              </div>
            </div>
            <Link to="/heroes" className="btn bs bsm" style={{ width: '100%', justifyContent: 'center' }}>
              View milestones →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [report, setReport] = useState<StaffDashboardReport | ClientDashboardReport | null>(null);
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([dataApi.reportsDashboard(), dataApi.submissions()])
      .then(([dash, list]) => {
        setReport(dash);
        setSubs(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, []);

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      {!report ? (
        <p className="muted">Loading reports…</p>
      ) : report.kind === 'staff' ? (
        <StaffDashboard user={user} report={report} subs={subs.filter((s) => s.stage < 9)} />
      ) : (
        <ClientDashboard user={user} report={report} subs={subs} />
      )}
    </div>
  );
}
