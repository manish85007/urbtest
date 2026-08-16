import { useEffect, useState } from 'react';
import { dataApi, filesApi, type HeroesReport, type PeriodQuery, type SessionUser } from '../api';
import { FileUpload } from '../components/FileUpload';
import { PeriodPicker } from '../components/PeriodPicker';

interface HeroesPageProps {
  user: SessionUser;
}

const MILESTONES = [10, 20, 30, 40, 50, 75, 100];

export function HeroesPage({ user }: HeroesPageProps) {
  const [report, setReport] = useState<HeroesReport | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [trees, setTrees] = useState('10');
  const [plantedAt, setPlantedAt] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });

  function load() {
    dataApi
      .heroes(period)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }

  useEffect(() => {
    load();
  }, [period.period, period.fy, period.year, period.from, period.to]);

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

  const planted = report?.treesPlanted ?? 0;
  const earned = report?.treesEarned ?? 0;
  const next = MILESTONES.find((n) => n > planted) ?? MILESTONES[MILESTONES.length - 1] + 10;
  const prev = [...MILESTONES].reverse().find((n) => n <= planted) ?? 0;
  const pct = next === prev ? 100 : Math.min(100, ((planted - prev) / (next - prev)) * 100);
  const treeMarks = '🌳'.repeat(Math.min(planted, 120));

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">Recycle Heroes</div>
          <div className="p-mu" style={{ margin: 0 }}>
            Every tonne you recycle with Urbeno plants a tree — and every tree keeps working after it&apos;s planted
          </div>
        </div>
        <div className="spacer" />
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      {report ? (
        <>
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
              borderColor: '#86efac',
              textAlign: 'center',
              padding: '1.4rem',
            }}
          >
            <div style={{ fontSize: '3.4rem', fontWeight: 800, color: '#14532d', lineHeight: 1 }}>{planted}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', marginBottom: '.2rem' }}>
              trees standing
            </div>
            <div className="dim" style={{ fontSize: '.85rem' }}>
              {earned} earned from closed tonnage · {report.outstanding} outstanding
            </div>
            {treeMarks ? (
              <div className="tree-grid" style={{ justifyContent: 'center', marginTop: '.8rem' }}>
                {treeMarks}
              </div>
            ) : null}
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-l">Trees earned ({report.period.fy})</div>
              <div className="stat-v">{earned}</div>
              <div className="stat-t">1 per tonne recycled</div>
            </div>
            <div className="stat">
              <div className="stat-l">Trees planted</div>
              <div className="stat-v">{planted}</div>
              <div className="stat-t">on the ledger</div>
            </div>
            <div className="stat">
              <div className="stat-l">Outstanding</div>
              <div className="stat-v" style={{ color: report.outstanding ? 'var(--am)' : 'var(--g2)' }}>
                {report.outstanding}
              </div>
              <div className="stat-t">scheduled for next drive</div>
            </div>
            <div className="stat">
              <div className="stat-l">Recycling CO₂e avoided</div>
              <div className="stat-v">{report.impact.co2.toFixed(0)}</div>
              <div className="stat-t">kg · separate from tree capture</div>
            </div>
          </div>

          <div className="card">
            <div className="section-hd">Milestones — a badge every 10 trees</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '.2rem' }}>
              {MILESTONES.map((n) => (
                <div key={n} className={`hero-badge ${planted >= n ? '' : 'locked'}`} title={planted >= n ? 'Unlocked' : 'Locked'}>
                  <div className="hero-badge-n">{n}</div>
                  <div className="hero-badge-l">{planted >= n ? 'trees' : 'locked'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '.8rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  color: 'var(--g2)',
                  marginBottom: '.25rem',
                }}
              >
                <span>Progress to {next} trees</span>
                <span>{Math.max(0, next - planted)} to go</span>
              </div>
              <div className="bar">
                <div className="bar-f" style={{ background: 'var(--g)', width: `${pct}%` }} />
                <div className="bar-t" style={{ color: pct > 45 ? '#fff' : 'var(--g2)' }}>
                  {pct.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          {user.role === 'admin' || user.role === 'client' ? (
            <div className="card">
              <div className="card-ttl">{user.role === 'client' ? '+ Log Our Own Planting' : 'Record tree planting'}</div>
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
                <button type="submit" className="btn bp">
                  Log planting
                </button>
              </form>
            </div>
          ) : null}

          {report.plantings.length > 0 ? (
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">Planting Record &amp; Growth Audit</div>
                <span className="dim" style={{ fontSize: '.76rem' }}>
                  {report.plantings.length} planting{report.plantings.length === 1 ? '' : 's'}
                </span>
              </div>
              {report.plantings.map((p) => (
                <div key={p.id} className="sub-card">
                  <div className="sub-card-hd">
                    <b>
                      {p.trees} tree{p.trees === 1 ? '' : 's'}
                    </b>
                    <span className="badge bg-g">{p.plantedAt.slice(0, 10)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '.4rem' }}>
                    <div className="tile">
                      <div className="tile-l">Location</div>
                      <div className="tile-v">{p.location || '—'}</div>
                    </div>
                    <div className="tile">
                      <div className="tile-l">Note</div>
                      <div className="tile-v">{p.note || '—'}</div>
                    </div>
                    <div className="tile">
                      <div className="tile-l">Growth photos</div>
                      <div className="tile-v">{p.progress?.length ?? 0}</div>
                    </div>
                  </div>
                  {(p.progress ?? []).map((g) => (
                    <p key={g.id} className="muted sm">
                      {g.notedAt} — {g.note || 'photo'}{' '}
                      <a href={filesApi.url(g.photoFileId)} target="_blank" rel="noreferrer">
                        view
                      </a>
                    </p>
                  ))}
                  <GrowthForm
                    plantingId={p.id}
                    plantedAt={p.plantedAt.slice(0, 10)}
                    onSaved={() => {
                      setMsg('Growth photo added.');
                      load();
                    }}
                    onError={(m) => setError(m)}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function GrowthForm({
  plantingId,
  plantedAt,
  onSaved,
  onError,
}: {
  plantingId: string;
  plantedAt: string;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [notedAt, setNotedAt] = useState(today);
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState('');

  return (
    <form
      className="sub-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await dataApi.addTreeProgress(plantingId, { notedAt, photoFileId: photoId, note });
          setNote('');
          setPhotoId('');
          onSaved();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Failed to add photo');
        }
      }}
    >
      <div className="fr2">
        <label>
          Photo date
          <input type="date" min={plantedAt} max={today} value={notedAt} onChange={(e) => setNotedAt(e.target.value)} required />
        </label>
        <label>
          Observation
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 6 months — average height 1.6 m" />
        </label>
      </div>
      <FileUpload
        kind="planting"
        label="Growth photo"
        accept="image/jpeg,image/png,image/webp"
        required
        value={photoId ? [photoId] : []}
        onChange={(ids) => setPhotoId(ids[0] ?? '')}
      />
      <button type="submit" className="btn bs bsm" disabled={!photoId}>
        Add to timeline
      </button>
    </form>
  );
}
