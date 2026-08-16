import { useEffect, useState } from 'react';
import { dataApi, type HeroesReport, type SessionUser } from '../api';

interface HeroesPageProps {
  user: SessionUser;
}

export function HeroesPage({ user }: HeroesPageProps) {
  const [report, setReport] = useState<HeroesReport | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [trees, setTrees] = useState('10');
  const [plantedAt, setPlantedAt] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  function load() {
    dataApi
      .heroes()
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }

  useEffect(() => {
    load();
  }, []);

  async function recordPlanting(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await dataApi.recordPlanting({
        trees: Number(trees),
        plantedAt,
        location,
        note,
        clientId: user.role === 'client' ? user.clientId ?? undefined : undefined,
      });
      setMsg('Planting recorded.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record planting');
    }
  }

  if (!report && !error) return <p className="muted">Loading Recycle Heroes…</p>;

  const emojiGrid = Array.from({ length: Math.min(report?.treesEarned ?? 0, 48) }, (_, i) => (
    <span key={i} className="tree-emoji">
      🌳
    </span>
  ));

  return (
    <div>
      <h1 className="h1">Recycle Heroes™</h1>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      {report ? (
        <>
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
          </div>

          <section className="card">
            <h2>Record tree planting</h2>
            <form className="sub-form" onSubmit={recordPlanting}>
              <div className="fr3">
                <label>
                  Trees
                  <input type="number" min="1" value={trees} onChange={(e) => setTrees(e.target.value)} required />
                </label>
                <label>
                  Planted on
                  <input type="date" value={plantedAt} onChange={(e) => setPlantedAt(e.target.value)} required />
                </label>
                <label>
                  Location
                  <input value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
              </div>
              <label>
                Note
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="submit" className="btn primary">
                Log planting
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Milestones</h2>
            <div className="tree-grid">{emojiGrid.length ? emojiGrid : <span className="muted">No trees yet.</span>}</div>
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
        </>
      ) : null}
    </div>
  );
}
