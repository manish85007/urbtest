import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, stageLabel } from '@urb-tectrack/shared';
import {
  dataApi,
  type ClientDashboardReport,
  type DashboardReport,
  type SessionUser,
  type StaffDashboardReport,
  type SubmissionSummary,
} from '../api';

interface DashboardPageProps {
  user: SessionUser;
}

function StaffDashboard({ report, subs }: { report: StaffDashboardReport; subs: SubmissionSummary[] }) {
  const overdueTotal = report.overdue.reduce((s, r) => s + BigInt(r.outstandingPaise), 0n);

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">New requests</div>
          <div className="stat-value warn">{report.stats.newRequests}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Open requests</div>
          <div className="stat-value">{report.stats.openRequests}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{report.stats.fyLabel || 'FY'} net kg</div>
          <div className="stat-value sm">{report.stats.fyNetKg.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Payments pending</div>
          <div className="stat-value warn">{report.stats.pendingPayments}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          {report.newRequests.length > 0 ? (
            <section className="card alert-warn">
              <h2>Awaiting acknowledgement</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Client</th>
                      <th>Approx.</th>
                      <th>Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.newRequests.map((r) => (
                      <tr key={r.id} className="click-row">
                        <td>
                          <Link to={`/requests/${r.id}`}>{r.id}</Link>
                        </td>
                        <td>
                          {r.clientName}
                          <div className="dim">{r.siteName}</div>
                        </td>
                        <td>
                          {r.approxWeight} kg
                          <div className="dim">{r.approxQty} units</div>
                        </td>
                        <td className="dim">{r.requestDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2>Active requests</h2>
            {subs.length === 0 ? (
              <p className="muted">No open requests.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Client</th>
                      <th>Stage</th>
                      <th>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.slice(0, 12).map((s) => (
                      <tr key={s.id} className="click-row">
                        <td>
                          <Link to={`/requests/${s.id}`}>{s.id}</Link>
                        </td>
                        <td>
                          {s.clientName}
                          <div className="dim">{s.siteName}</div>
                        </td>
                        <td>
                          <span className="badge">{stageLabel(s.stage)}</span>
                        </td>
                        <td>{s.approxWeight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="dash-side">
          {report.overdue.length > 0 ? (
            <section className="card alert-danger">
              <div className="card-hd-row">
                <h2>Payments overdue</h2>
                <span className="badge danger">{report.overdue.length}</span>
                <span className="spacer" />
                <strong className="danger-text">{formatINR(Number(overdueTotal))}</strong>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Outstanding</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.overdue.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo} className="click-row">
                        <td>
                          <Link to={`/requests/${r.submissionId}`}>{r.invoiceNo}</Link>
                          <div className="dim">{r.clientName}</div>
                        </td>
                        <td>{formatINR(Number(r.outstandingPaise))}</td>
                        <td>
                          <span className="badge danger">{r.overdueDays}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {report.slaAtRisk.length > 0 ? (
            <section className="card alert-warn">
              <h2>Recycling SLA at risk</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Elapsed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.slaAtRisk.slice(0, 6).map((r) => (
                      <tr key={r.invoiceNo} className="click-row">
                        <td>
                          <Link to={`/requests/${r.submissionId}`}>{r.invoiceNo}</Link>
                          <div className="dim">{r.clientName}</div>
                        </td>
                        <td>
                          {r.daysUsed} / {r.slaDays}
                        </td>
                        <td>
                          <span className="badge warn">{r.stateLabel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <WorkQueue title="Awaiting MRN" items={report.queues.awaitingMrn} />
          <WorkQueue title="Awaiting recycling" items={report.queues.awaitingRecycling} />
          {report.queues.awaitingCod.length > 0 ? (
            <WorkQueue title="Awaiting CoD upload" items={report.queues.awaitingCod} />
          ) : null}
          <WorkQueue title="Awaiting client close" items={report.queues.awaitingClose} />
        </div>
      </div>
    </>
  );
}

function WorkQueue({ title, items }: { title: string; items: StaffDashboardReport['queues']['awaitingMrn'] }) {
  if (!items.length) return null;
  return (
    <section className="card compact">
      <div className="card-hd-row">
        <h2>{title}</h2>
        <span className="badge">{items.length}</span>
      </div>
      <ul className="list">
        {items.slice(0, 6).map((item) => (
          <li key={item.invoiceId}>
            <Link to={`/requests/${item.submissionId}`}>
              <strong>{item.invoiceNo}</strong>
            </Link>
            <span className="dim"> · {item.clientName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClientDashboard({ report }: { report: ClientDashboardReport }) {
  const { impact } = report;

  return (
    <>
      <p className="muted">{report.period.fy} · closed lifecycle impact</p>

      {report.pendingClose.length > 0 ? (
        <section className="card alert-ok">
          <h2>Certificates ready for review</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Invoice</th>
                  <th>Certificate(s)</th>
                </tr>
              </thead>
              <tbody>
                {report.pendingClose.map((p) => (
                  <tr key={p.invoiceNo} className="click-row">
                    <td>
                      <Link to={`/requests/${p.submissionId}`}>{p.submissionId}</Link>
                    </td>
                    <td>{p.invoiceNo}</td>
                    <td>{p.certificates.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Recycled ({report.period.fy})</div>
          <div className="stat-value sm">{impact.kg.toLocaleString()} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">CO₂ avoided</div>
          <div className="stat-value sm">{impact.co2.toFixed(1)} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Landfill diverted</div>
          <div className="stat-value sm">{impact.landfill.toFixed(0)} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tree equivalent</div>
          <div className="stat-value sm">{impact.trees.toFixed(1)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Recycle Heroes trees</div>
          <div className="stat-value">{report.treesEarned}</div>
        </div>
      </div>

      <section className="card">
        <h2>Sustainability detail</h2>
        <p className="muted">
          Based on {impact.invoices} closed invoice{impact.invoices === 1 ? '' : 's'} across{' '}
          {impact.submissions} request{impact.submissions === 1 ? '' : 's'}.
        </p>
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Water saved</div>
            <div className="stat-value sm">{impact.water.toFixed(1)} kL</div>
          </div>
          <div className="stat">
            <div className="stat-label">Energy saved</div>
            <div className="stat-value sm">{impact.energy.toFixed(1)} kWh</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tonnes</div>
            <div className="stat-value sm">{impact.tonnes.toFixed(2)}</div>
          </div>
        </div>
      </section>
    </>
  );
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([dataApi.reportsDashboard(), dataApi.submissions()])
      .then(([dash, list]) => {
        setReport(dash);
        setSubs(list.filter((s) => s.stage < 9));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, []);

  return (
    <div>
      <div className="f-row">
        <h1 className="h1">
          {user.role === 'client' ? 'Your dashboard' : 'Operations dashboard'}
        </h1>
        <Link to="/requests/new" className="btn primary">
          + New request
        </Link>
      </div>
      <p className="muted">Welcome back, {user.name}.</p>

      {error ? <p className="error">{error}</p> : null}

      {!report ? (
        <p className="muted">Loading reports…</p>
      ) : report.kind === 'staff' ? (
        <StaffDashboard report={report} subs={subs} />
      ) : (
        <ClientDashboard report={report} />
      )}

      {report?.kind === 'client' ? (
        <section className="card">
          <h2>Your requests</h2>
          {subs.length === 0 ? (
            <p className="muted">
              No open requests. <Link to="/requests/new">Raise a pickup request</Link>.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Site</th>
                    <th>Stage</th>
                    <th>Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="click-row">
                      <td>
                        <Link to={`/requests/${s.id}`}>{s.id}</Link>
                      </td>
                      <td>{s.siteName}</td>
                      <td>
                        <span className="badge">{stageLabel(s.stage)}</span>
                      </td>
                      <td>{s.approxWeight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
