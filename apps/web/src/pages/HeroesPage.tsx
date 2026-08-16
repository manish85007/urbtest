import { useEffect, useState } from 'react';
import { dataApi, type HeroesReport, type SessionUser } from '../api';

interface HeroesPageProps {
  user: SessionUser;
}

export function HeroesPage({ user }: HeroesPageProps) {
  const [report, setReport] = useState<HeroesReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dataApi
      .heroes()
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="muted">Loading Recycle Heroes…</p>;

  const trees = Math.min(report.treesEarned, 48);
  const emojiGrid = Array.from({ length: trees }, (_, i) => (
    <span key={i} className="tree-emoji" title={`Tree ${i + 1}`}>
      🌳
    </span>
  ));

  return (
    <div>
      <h1 className="h1">Recycle Heroes™</h1>
      <p className="muted">
        {user.role === 'admin'
          ? 'Portfolio tree milestones across clients'
          : 'Your recycling impact converted to trees'}
      </p>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Trees earned ({report.period.fy})</div>
          <div className="stat-value">{report.treesEarned}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Trees planted</div>
          <div className="stat-value">{report.treesPlanted}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value warn">{report.outstanding}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Recycled (FY)</div>
          <div className="stat-value sm">{report.impact.kg.toLocaleString()} kg</div>
        </div>
      </div>

      <section className="card">
        <h2>Milestones</h2>
        <p className="muted">One tree earned per tonne of e-waste recycled (prototype rule).</p>
        <div className="tree-grid">{emojiGrid.length ? emojiGrid : <span className="muted">No trees yet — close a request to earn your first.</span>}</div>
      </section>

      {report.plantings.length > 0 ? (
        <section className="card">
          <h2>Planting record</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Trees</th>
                  <th>Location</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {report.plantings.map((p) => (
                  <tr key={p.id}>
                    <td>{p.plantedAt}</td>
                    <td>{p.trees}</td>
                    <td>{p.location ?? '—'}</td>
                    <td>{p.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
