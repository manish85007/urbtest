import { useEffect, useState } from 'react';
import { SUSTAINABILITY } from '@urb-tectrack/shared';
import {
  dataApi,
  filesApi,
  type HeroesAdminReport,
  type HeroesClientReport,
  type HeroesPlanting,
  type PeriodQuery,
  type SessionUser,
} from '../api';
import { PeriodPicker } from '../components/PeriodPicker';
import { num } from '../lib/format';
import { PlantModal } from './heroes/PlantModal';
import { ProgressModal } from './heroes/ProgressModal';
import { TreeCard } from './heroes/TreeCard';

interface HeroesPageProps {
  user: SessionUser;
}

export function HeroesPage({ user }: HeroesPageProps) {
  if (user.role === 'client') return <HeroesClient user={user} />;
  return <HeroesAdmin />;
}

function HeroesClient({ user }: { user: SessionUser }) {
  const [report, setReport] = useState<HeroesClientReport | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });
  const [plantOpen, setPlantOpen] = useState(false);
  const [progressFor, setProgressFor] = useState<HeroesPlanting | null>(null);

  function load() {
    dataApi
      .heroes(period)
      .then((r) => {
        if (r.view !== 'client') setError('Recycle Heroes client view is available to client users.');
        else setReport(r);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }

  useEffect(() => {
    load();
  }, [period.period, period.fy, period.year, period.from, period.to]);

  if (!report && !error) return <p className="muted">Loading Recycle Heroes…</p>;
  if (!report) return <p className="error">{error}</p>;

  const h = report.metrics;
  const seq = report.seq;
  const trees = '🌳'.repeat(Math.min(h.plantedAll, 120));
  const growthPhotos = report.plantings.reduce((a, t) => a + t.progress.length, 0);

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
        <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noreferrer">
          📄 Methodology
        </a>
        <button type="button" className="btn bp" onClick={() => setPlantOpen(true)}>
          + Log Our Own Planting
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
          borderColor: '#86efac',
          textAlign: 'center',
          padding: '1.4rem',
        }}
      >
        <div style={{ fontSize: '3.4rem', fontWeight: 800, color: '#14532d', lineHeight: 1 }}>{h.plantedAll}</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', marginBottom: '.2rem' }}>
          trees standing for {report.clientName}
        </div>
        <div className="dim" style={{ fontSize: '.85rem' }}>
          {h.byUrbeno} planted by Urbeno against your tonnage · {h.byClient} from your own CSR drives
        </div>
        {trees ? (
          <div
            className="tree-grid"
            style={{ justifyContent: 'center', marginTop: '.8rem', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}
          >
            {trees}
          </div>
        ) : null}
        {h.owed > 0 ? (
          <div style={{ marginTop: '.7rem', fontSize: '.8rem', color: '#166534' }}>
            {h.owed} more tree{h.owed > 1 ? 's' : ''} earned and scheduled for our next planting drive
          </div>
        ) : null}
      </div>

      <div className="stats" style={{ marginBottom: '1rem' }}>
        <div className="stat" style={{ background: 'linear-gradient(135deg,#dbeafe,#eff6ff)', borderColor: '#93c5fd' }}>
          <div className="stat-l" style={{ color: '#1e40af' }}>
            CO₂ Sequestered to Date
          </div>
          <div className="stat-v" style={{ color: '#1e3a8a' }}>
            {num(seq.kg)}
          </div>
          <div className="stat-t">kg · accrues daily from each planting date</div>
        </div>
        <div className="stat">
          <div className="stat-l">Absorbing Right Now</div>
          <div className="stat-v">{seq.perDay.toFixed(2)}</div>
          <div className="stat-t">kg CO₂ per day</div>
        </div>
        <div className="stat">
          <div className="stat-l">Tree-Days Banked</div>
          <div className="stat-v">{num(seq.treeDays)}</div>
          <div className="stat-t">tree × days since planting</div>
        </div>
        <div className="stat">
          <div className="stat-l">Growth Photos</div>
          <div className="stat-v">{growthPhotos}</div>
          <div className="stat-t">audit record</div>
        </div>
      </div>

      <div className="card">
        <div className="section-hd">Milestones — a badge every {SUSTAINABILITY.heroMilestone} trees</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '.2rem' }}>
          {h.badges.map((b) => (
            <div key={b.n} className={`hero-badge ${b.unlocked ? '' : 'locked'}`} title={b.unlocked ? 'Unlocked' : 'Locked'}>
              <div className="hero-badge-n">{b.n}</div>
              <div className="hero-badge-l">{b.unlocked ? 'trees' : 'locked'}</div>
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
            <span>Progress to {h.nextBadge} trees</span>
            <span>{h.toNext} to go</span>
          </div>
          <div className="bar">
            <div className="bar-f" style={{ background: 'var(--g)', width: `${Math.min(100, h.pctToNext)}%` }} />
            <div className="bar-t" style={{ color: h.pctToNext > 45 ? '#fff' : 'var(--g2)' }}>
              {h.pctToNext.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <PeriodPicker variant="card" value={period} onChange={setPeriod} />
      <div className="stats" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="stat-l">Tonnes — {report.period.label || report.period.fy}</div>
          <div className="stat-v">{h.tonnes.toFixed(2)}</div>
          <div className="stat-t">completed</div>
        </div>
        <div className="stat">
          <div className="stat-l">Trees Earned</div>
          <div className="stat-v">{h.earned}</div>
          <div className="stat-t">1 per tonne</div>
        </div>
        <div className="stat">
          <div className="stat-l">Trees Planted</div>
          <div className="stat-v">{h.planted}</div>
          <div className="stat-t">in this period</div>
        </div>
        <div className="stat">
          <div className="stat-l">Recycling CO₂e Avoided</div>
          <div className="stat-v">{num(h.co2)}</div>
          <div className="stat-t">kg · separate from tree capture</div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Planting Record &amp; Growth Audit</div>
          <div className="spacer" />
          <span className="dim" style={{ fontSize: '.76rem' }}>
            {report.plantings.length} planting{report.plantings.length !== 1 ? 's' : ''}
          </span>
        </div>
        {!report.plantings.length ? (
          <div className="dim" style={{ fontSize: '.84rem', padding: '.5rem 0' }}>
            No plantings recorded yet. Trees are planted in batches at our partner sites.
          </div>
        ) : (
          report.plantings.map((t) => (
            <TreeCard
              key={t.id}
              planting={t}
              canEdit={false}
              showClientCsrProgress
              onAddProgress={setProgressFor}
            />
          ))
        )}
      </div>

      {plantOpen ? (
        <PlantModal
          asClient
          clientId={user.clientId ?? undefined}
          clientName={report.clientName}
          onClose={() => setPlantOpen(false)}
          onSaved={(m) => {
            setPlantOpen(false);
            setMsg(m);
            load();
          }}
        />
      ) : null}
      {progressFor ? (
        <ProgressModal
          planting={progressFor}
          onClose={() => setProgressFor(null)}
          onSaved={() => {
            setProgressFor(null);
            setMsg('✓ Growth photo added');
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function HeroesAdmin() {
  const [report, setReport] = useState<HeroesAdminReport | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });
  const [ledgerClientId, setLedgerClientId] = useState('');
  const [plantFor, setPlantFor] = useState<string | null | undefined>(undefined);
  const [progressFor, setProgressFor] = useState<HeroesPlanting | null>(null);

  function load() {
    dataApi
      .heroes(period, ledgerClientId || undefined)
      .then((r) => {
        if (r.view !== 'admin') setError('Recycle Heroes staff view is available to Urbeno users.');
        else setReport(r);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }

  useEffect(() => {
    load();
  }, [period.period, period.fy, period.year, period.from, period.to, ledgerClientId]);

  if (!report && !error) return <p className="muted">Loading Recycle Heroes…</p>;
  if (!report) return <p className="error">{error}</p>;

  const tot = report.totals;

  async function removePlanting(t: HeroesPlanting) {
    if (!confirm('Remove this planting record?')) return;
    try {
      await dataApi.removePlanting(t.id);
      setMsg('Removed');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  async function removeProgress(t: HeroesPlanting, progressId: string) {
    if (!confirm('Remove this growth photo from the timeline?')) return;
    try {
      await dataApi.removeTreeProgress(t.id, progressId);
      setMsg('Removed');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <div className="h1">🌳 Recycle Heroes</div>
          <div className="p-mu" style={{ margin: 0 }}>
            Tree ledger — {SUSTAINABILITY.treesPerTonne} tree per tonne completed, badge every{' '}
            {SUSTAINABILITY.heroMilestone} trees
          </div>
        </div>
        <div className="spacer" />
        <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noreferrer">
          📄 Methodology
        </a>
        <button type="button" className="btn bp" onClick={() => setPlantFor(null)}>
          + Record Planting
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      <div className="stats" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="stat-l">Trees Earned</div>
          <div className="stat-v">{tot.earnedAll}</div>
          <div className="stat-t">lifetime, all clients</div>
        </div>
        <div className="stat">
          <div className="stat-l">Planted by Urbeno</div>
          <div className="stat-v">{tot.byUrbeno}</div>
          <div className="stat-t">against tonnage</div>
        </div>
        <div className="stat">
          <div className="stat-l">Outstanding</div>
          <div className="stat-v" style={{ color: tot.owed > 0 ? 'var(--am)' : 'var(--g2)' }}>
            {tot.owed}
          </div>
          <div className="stat-t">to plant</div>
        </div>
        <div className="stat">
          <div className="stat-l">Client CSR Trees</div>
          <div className="stat-v">{tot.byClient}</div>
          <div className="stat-t">logged by clients</div>
        </div>
        <div className="stat">
          <div className="stat-l">CO₂ Sequestered</div>
          <div className="stat-v">{num(tot.seq.kg)}</div>
          <div className="stat-t">
            kg to date · {tot.seq.perDay.toFixed(2)}/day
          </div>
        </div>
      </div>

      <PeriodPicker variant="card" value={period} onChange={setPeriod} />

      <div className="card" style={{ padding: '.4rem' }}>
        <div style={{ padding: '.4rem .5rem', fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)' }}>
          Per-client position
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Tonnes (period)</th>
                <th>Lifetime tonnes</th>
                <th>Earned</th>
                <th>Planted</th>
                <th>Outstanding</th>
                <th>Milestone</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {report.clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b> <span className="badge bg-gy">{c.id}</span>
                  </td>
                  <td className="mono">{c.tonnes.toFixed(2)}</td>
                  <td className="mono">{c.lifetimeTonnes.toFixed(2)}</td>
                  <td className="mono">{c.earnedAll}</td>
                  <td className="mono">
                    {c.byUrbeno}
                    {c.byClient ? (
                      <div className="dim" style={{ fontSize: '.7rem' }}>
                        +{c.byClient} client CSR
                      </div>
                    ) : null}
                  </td>
                  <td className={`mono ${c.owed > 0 ? 'warn' : ''}`}>{c.owed}</td>
                  <td>
                    {c.badge ? <span className="badge bg-g">{c.badge} trees</span> : <span className="dim">—</span>}
                  </td>
                  <td>
                    <button type="button" className="btn bs bsm" onClick={() => setPlantFor(c.id)}>
                      + Plant
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Planting Ledger</div>
          <div className="spacer" />
          <select
            value={ledgerClientId}
            onChange={(e) => setLedgerClientId(e.target.value)}
            style={{ maxWidth: 220, padding: '.3rem .5rem', fontSize: '.82rem' }}
          >
            <option value="">All clients</option>
            {report.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!report.plantings.length ? (
          <div className="dim" style={{ fontSize: '.84rem' }}>
            No plantings recorded
          </div>
        ) : (
          report.plantings.map((t) => (
            <div key={t.id} style={{ marginBottom: '.2rem' }}>
              <div className="dim" style={{ fontSize: '.74rem', fontWeight: 600, marginBottom: '.15rem' }}>
                {t.clientName}
              </div>
              <TreeCard
                planting={t}
                canEdit
                onAddProgress={setProgressFor}
                onRemove={(p) => void removePlanting(p)}
                onRemoveProgress={(p, id) => void removeProgress(p, id)}
              />
            </div>
          ))
        )}
      </div>

      {plantFor !== undefined ? (
        <PlantModal
          asClient={false}
          clientId={plantFor ?? undefined}
          clients={report.clients}
          onClose={() => setPlantFor(undefined)}
          onSaved={(m) => {
            setPlantFor(undefined);
            setMsg(m);
            load();
          }}
        />
      ) : null}
      {progressFor ? (
        <ProgressModal
          planting={progressFor}
          onClose={() => setProgressFor(null)}
          onSaved={() => {
            setProgressFor(null);
            setMsg('✓ Growth photo added');
            load();
          }}
        />
      ) : null}
    </div>
  );
}
