import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUSTAINABILITY } from '@urb-tectrack/shared';
import {
  dataApi,
  filesApi,
  type ClientDashboardReport,
  type PeriodQuery,
  type RegisterReport,
  type SessionUser,
} from '../api';
import { PeriodPicker } from '../components/PeriodPicker';
import { isAdminUser, isStaffUser } from '../lib/permissions';

function periodQs(period: PeriodQuery) {
  return `period=${encodeURIComponent(period.period ?? 'fy')}&fy=${encodeURIComponent(period.fy ?? '')}&year=${encodeURIComponent(period.year ?? '')}&from=${encodeURIComponent(period.from ?? '')}&to=${encodeURIComponent(period.to ?? '')}`;
}

export function ImpactPage({ user }: { user?: SessionUser }) {
  const [report, setReport] = useState<ClientDashboardReport | null>(null);
  const [staffReport, setStaffReport] = useState<RegisterReport | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });
  const isAdmin = user ? isAdminUser(user) : false;
  const isStaff = user ? isStaffUser(user) : false;

  useEffect(() => {
    setError('');
    if (isStaff) {
      dataApi
        .register('sustain', period)
        .then((r) => {
          setReport(null);
          setStaffReport(r);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
      return;
    }
    dataApi
      .reportsDashboard(undefined, period)
      .then((r) => {
        if (r.kind === 'client') {
          setReport(r);
          setStaffReport(null);
        } else {
          setError('Sustainability is only available for client accounts or staff roles.');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [period.period, period.fy, period.year, period.from, period.to, isStaff]);

  const totals = useMemo(() => {
    if (!staffReport?.rows.length) return null;
    const kgIdx = staffReport.head.findIndex((h) => /net kg/i.test(h));
    const co2Idx = staffReport.head.findIndex((h) => /co2/i.test(h));
    const invIdx = staffReport.head.findIndex((h) => /invoice/i.test(h));
    const sum = (idx: number) =>
      idx < 0 ? 0 : staffReport.rows.reduce((s, row) => s + (Number(row[idx]) || 0), 0);
    return {
      kg: sum(kgIdx),
      co2: sum(co2Idx),
      invoices: sum(invIdx),
      clients: staffReport.rows.length,
    };
  }, [staffReport]);

  async function share(clientName: string, clientId?: string) {
    if (!clientId) return;
    setBusyId(clientId);
    setError('');
    setMsg('');
    try {
      const res = await dataApi.shareImpact({ clientId, ...period });
      setMsg(`Shared ${res.clientName} impact with ${res.sent} recipient${res.sent === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not share ${clientName}`);
    } finally {
      setBusyId('');
    }
  }

  if (error && !staffReport && !report) return <p className="error">{error}</p>;
  if (!report && !staffReport) return <p className="muted">Loading sustainability impact…</p>;

  if (staffReport) {
    const qs = periodQs(period);
    const idIdx = staffReport.head.findIndex((h) => h === 'Client ID');
    const nameIdx = staffReport.head.findIndex((h) => h === 'Client');
    return (
      <div>
        <div className="f-row" style={{ marginBottom: '.9rem' }}>
          <div>
            <div className="h1">Sustainability</div>
            <div className="p-mu" style={{ margin: 0 }}>
              {staffReport.periodLabel} · overall and client-wise closed-lifecycle impact
            </div>
          </div>
          <div className="spacer" />
          <PeriodPicker value={period} onChange={setPeriod} />
          <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noopener noreferrer">
            📄 Methodology
          </a>
          <a className="btn bs" href={filesApi.pdf(`/reports/impact.pdf?${qs}`)} target="_blank" rel="noopener noreferrer">
            Portfolio PDF
          </a>
          <Link to="/heroes" className="btn bp">
            Recycling Heroes →
          </Link>
        </div>
        {msg ? <p className="ok-msg">{msg}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {totals ? (
          <div className="stats">
            <div className="stat">
              <div className="stat-l">Clients with closed work</div>
              <div className="stat-v">{totals.clients}</div>
            </div>
            <div className="stat">
              <div className="stat-l">Weight recycled</div>
              <div className="stat-v">{totals.kg.toLocaleString()}</div>
              <div className="stat-t">kg billed and closed</div>
            </div>
            <div className="stat" style={{ background: 'linear-gradient(135deg,#dbeafe,#eff6ff)', borderColor: '#93c5fd' }}>
              <div className="stat-l" style={{ color: '#1e40af' }}>
                CO₂e avoided
              </div>
              <div className="stat-v" style={{ color: '#1e3a8a' }}>
                {totals.co2.toFixed(0)}
              </div>
              <div className="stat-t">kg</div>
            </div>
            <div className="stat">
              <div className="stat-l">Closed invoices</div>
              <div className="stat-v">{totals.invoices}</div>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="dim" style={{ margin: 0 }}>
              No closed requests in this period yet. Sustainability figures only count requests the client has
              acknowledged closed.
            </p>
          </div>
        )}

        <div className="card">
          <div className="section-hd">Client-wise review</div>
          <p className="dim" style={{ fontSize: '.82rem' }}>
            Scope: {staffReport.scopeLabel}. Generate a client PDF or email it to that organisation’s portal users.
          </p>
          <div className="tw" style={{ marginTop: '.6rem' }}>
            <table>
              <thead>
                <tr>
                  {staffReport.head.map((head) => (
                    <th key={head}>{head}</th>
                  ))}
                  {isAdmin || isStaff ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {staffReport.rows.map((row, idx) => {
                  const clientId = String(row[idIdx] ?? '');
                  const name = String(row[nameIdx] ?? clientId);
                  return (
                    <tr key={idx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx}>{cell}</td>
                      ))}
                      {isAdmin || isStaff ? (
                        <td>
                          <div className="frow" style={{ flexWrap: 'nowrap' }}>
                            <a
                              className="btn bs bsm"
                              href={filesApi.pdf(`/reports/impact.pdf?${qs}&clientId=${encodeURIComponent(clientId)}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF
                            </a>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn bp bsm"
                                disabled={!!busyId}
                                onClick={() => void share(name, clientId)}
                              >
                                {busyId === clientId ? 'Sharing…' : 'Share'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return <p className="muted">Loading sustainability impact…</p>;
  const { impact } = report;
  const qs = periodQs(period);

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">Sustainability</div>
          <div className="p-mu" style={{ margin: 0 }}>
            {report.period.label || report.period.fy} · closed lifecycle impact for BRSR / ESG disclosure
          </div>
        </div>
        <div className="spacer" />
        <PeriodPicker value={period} onChange={setPeriod} />
        <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noopener noreferrer">
          📄 How these numbers are built
        </a>
        <a className="btn bs" href={filesApi.pdf(`/reports/impact.pdf?${qs}`)} target="_blank" rel="noopener noreferrer">
          Impact PDF
        </a>
        <Link to="/heroes" className="btn bp">
          Recycling Heroes →
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-l">Weight recycled</div>
          <div className="stat-v">{impact.kg.toLocaleString()}</div>
          <div className="stat-t">kg billed and closed</div>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg,#dbeafe,#eff6ff)', borderColor: '#93c5fd' }}>
          <div className="stat-l" style={{ color: '#1e40af' }}>
            CO₂e avoided
          </div>
          <div className="stat-v" style={{ color: '#1e3a8a' }}>
            {impact.co2.toFixed(0)}
          </div>
          <div className="stat-t">kg · EPA WARM v16 × {SUSTAINABILITY.co2PerKg} kg/kg</div>
        </div>
        <div className="stat">
          <div className="stat-l">Landfill diverted</div>
          <div className="stat-v">{impact.landfill.toFixed(0)}</div>
          <div className="stat-t">kg · R2v3 recovery {SUSTAINABILITY.landfillRatio * 100}%</div>
        </div>
        <div className="stat">
          <div className="stat-l">Water saved</div>
          <div className="stat-v">{impact.water.toFixed(1)}</div>
          <div className="stat-t">kL</div>
        </div>
        <div className="stat">
          <div className="stat-l">Energy saved</div>
          <div className="stat-v">{impact.energy.toFixed(1)}</div>
          <div className="stat-t">kWh</div>
        </div>
      </div>

      <div className="card">
        <div className="section-hd">What is counted</div>
        <p style={{ fontSize: '.87rem', marginBottom: '.5rem' }}>
          Metrics are derived from <b>closed invoices</b> in the selected financial year — billing weight, material
          recovery assumptions, and Urbeno&apos;s published coefficients (ported from the v6.3.1 prototype).
        </p>
        <p className="dim" style={{ fontSize: '.82rem' }}>
          Based on {impact.invoices} closed invoice{impact.invoices === 1 ? '' : 's'} across {impact.submissions}{' '}
          request{impact.submissions === 1 ? '' : 's'} · {impact.tonnes.toFixed(2)} tonnes.
        </p>
      </div>

      <div className="card">
        <div className="section-hd">Methodology</div>
        <ul className="legal" style={{ marginLeft: '1.1rem' }}>
          <li>
            <b>Recycling Heroes promise:</b> every 1 tonne of closed e-waste earns 1 sapling, nurtured for{' '}
            {SUSTAINABILITY.nurtureYears} years toward self-reliance
          </li>
          <li>CO₂e avoided: {SUSTAINABILITY.co2PerKg} kg per kg e-waste — EPA WARM v16, mixed electronics</li>
          <li>Landfill diversion: {SUSTAINABILITY.landfillRatio} — R2v3 downstream recovery average</li>
          <li>Water / energy: {SUSTAINABILITY.waterPerKg} kL and {SUSTAINABILITY.energyPerKg} kWh per kg</li>
          <li>
            One organisation’s tonne keeps toxins out of soil and water; the sapling it unlocks cools air, holds
            soil, and benefits the wider neighbourhood over years — small closed loops that scale into public good
          </li>
        </ul>
        <a className="btn bs bsm" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noopener noreferrer">
          📄 Open full methodology PDF
        </a>
      </div>
    </div>
  );
}
