import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dataApi, type ClientDashboardReport } from '../api';

export function ImpactPage() {
  const [report, setReport] = useState<ClientDashboardReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dataApi
      .reportsDashboard()
      .then((r) => {
        if (r.kind === 'client') setReport(r);
        else setError('Sustainability impact is available to client users.');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="muted">Loading sustainability impact…</p>;

  const { impact } = report;

  return (
    <div>
      <h1 className="h1">Sustainability impact</h1>
      <p className="muted">{report.period.fy} · closed lifecycle impact</p>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Weight recycled</div>
          <div className="stat-value sm">{impact.kg.toLocaleString()} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">CO₂e avoided</div>
          <div className="stat-value sm">{impact.co2.toFixed(1)} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Landfill diverted</div>
          <div className="stat-value sm">{impact.landfill.toFixed(0)} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Water saved</div>
          <div className="stat-value sm">{impact.water.toFixed(1)} kL</div>
        </div>
        <div className="stat">
          <div className="stat-label">Energy saved</div>
          <div className="stat-value sm">{impact.energy.toFixed(1)} kWh</div>
        </div>
      </div>

      <section className="card">
        <h2>What is counted</h2>
        <p className="muted">
          Metrics are derived from closed invoices in the current financial year — billing weight,
          material recovery assumptions, and Urbeno&apos;s published sustainability coefficients
          (ported from the prototype).
        </p>
        <p>
          Based on {impact.invoices} closed invoice{impact.invoices === 1 ? '' : 's'} across{' '}
          {impact.submissions} request{impact.submissions === 1 ? '' : 's'}.
        </p>
      </section>

      <section className="card">
        <h2>Methodology</h2>
        <p className="muted">
          CO₂, landfill diversion, water and energy savings use the same factors as the v6.3
          prototype sustainability module. Use this page for client BRSR and ESG disclosures.
        </p>
        <Link to="/heroes" className="btn secondary">
          View Recycle Heroes →
        </Link>
      </section>
    </div>
  );
}
