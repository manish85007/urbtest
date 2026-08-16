import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUSTAINABILITY } from '@urb-tectrack/shared';
import { dataApi, filesApi, type ClientDashboardReport, type PeriodQuery } from '../api';
import { PeriodPicker } from '../components/PeriodPicker';

export function ImpactPage() {
  const [report, setReport] = useState<ClientDashboardReport | null>(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });

  useEffect(() => {
    dataApi
      .reportsDashboard(undefined, period)
      .then((r) => {
        if (r.kind === 'client') setReport(r);
        else setError('Sustainability impact is available to client users.');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [period.period, period.fy, period.year, period.from, period.to]);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="muted">Loading sustainability impact…</p>;

  const { impact } = report;

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
        <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noreferrer">
          Methodology PDF
        </a>
        <a
          className="btn bs"
          href={filesApi.pdf(
            `/reports/impact.pdf?period=${encodeURIComponent(period.period ?? 'fy')}&fy=${encodeURIComponent(period.fy ?? '')}&year=${encodeURIComponent(period.year ?? '')}&from=${encodeURIComponent(period.from ?? '')}&to=${encodeURIComponent(period.to ?? '')}`,
          )}
          target="_blank"
          rel="noreferrer"
        >
          Impact PDF
        </a>
        <Link to="/heroes" className="btn bp">
          Recycle Heroes →
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
          <li>CO₂e avoided: {SUSTAINABILITY.co2PerKg} kg per kg e-waste — EPA WARM v16, mixed electronics</li>
          <li>Landfill diversion: {SUSTAINABILITY.landfillRatio} — R2v3 downstream recovery average</li>
          <li>Tree equivalent: {SUSTAINABILITY.co2PerTree} kg CO₂ per tree per year — US Forest Service</li>
          <li>Water / energy: {SUSTAINABILITY.waterPerKg} kL and {SUSTAINABILITY.energyPerKg} kWh per kg</li>
        </ul>
      </div>
    </div>
  );
}
