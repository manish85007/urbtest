import { useEffect, useRef, useState } from 'react';
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
import { useAnimatedNumber } from '../lib/useAnimatedNumber';
import { type ForestFilter, HeroesForest } from './heroes/HeroesForest';
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
  const [forestFilter, setForestFilter] = useState<ForestFilter>('all');
  const [selectedPlantingId, setSelectedPlantingId] = useState<string | null>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!selectedPlantingId || !ledgerRef.current) return;
    const el = ledgerRef.current.querySelector(`[data-planting-id="${selectedPlantingId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedPlantingId]);

  const plantedAll = report?.metrics.plantedAll ?? 0;
  const seqKg = report?.seq.kg ?? 0;
  const seqPerDay = report?.seq.perDay ?? 0;
  const plantedCount = useAnimatedNumber(plantedAll);
  const co2Seq = useAnimatedNumber(Math.round(seqKg));
  const perDayDisplay = useAnimatedNumber(Math.round(seqPerDay * 100)) / 100;

  if (!report && !error) return <p className="muted">Loading Recycle Heroes…</p>;
  if (!report) return <p className="error">{error}</p>;

  const h = report.metrics;
  const seq = report.seq;
  const growthPhotos = report.plantings.reduce((a, t) => a + t.progress.length, 0);

  const filteredPlantings = report.plantings.filter((p) => {
    if (forestFilter === 'all') return true;
    if (forestFilter === 'pending') return false;
    if (forestFilter === 'client') return p.source === 'client';
    return p.source !== 'client';
  });

  const forestFilters: Array<{ id: ForestFilter; label: string; count: number }> = [
    { id: 'all', label: 'All trees', count: h.plantedAll + h.owed },
    { id: 'urbeno', label: 'Urbeno', count: h.byUrbeno },
    { id: 'client', label: 'Your CSR', count: h.byClient },
    ...(h.owed > 0 ? [{ id: 'pending' as const, label: 'Scheduled', count: h.owed }] : []),
  ];

  return (
    <div className="heroes-client">
      <div className="heroes-client-hd f-row">
        <div>
          <div className="h1">🌳 Recycle Heroes</div>
          <div className="p-mu" style={{ margin: 0 }}>
            Every tonne you recycle plants a tree — click trees in your forest to explore each planting
          </div>
        </div>
        <div className="spacer" />
        <a className="btn bs" href={filesApi.pdf('/reports/methodology.pdf')} target="_blank" rel="noreferrer">
          📄 Methodology
        </a>
        <button type="button" className="btn bp" onClick={() => setPlantOpen(true)}>
          + Log CSR Planting
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      <section className="heroes-hero-card">
        <div className="heroes-hero-stats">
          <div className="heroes-hero-count">
            <span className="heroes-hero-count-v">{plantedCount}</span>
            <span className="heroes-hero-count-l">trees standing for {report.clientName}</span>
            <span className="heroes-hero-count-s">
              {h.byUrbeno} by Urbeno · {h.byClient} from your CSR
              {h.owed > 0 ? ` · ${h.owed} scheduled` : ''}
            </span>
          </div>
          <div className="heroes-filter-chips">
            {forestFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`heroes-filter-chip${forestFilter === f.id ? ' on' : ''}`}
                onClick={() => {
                  setForestFilter(f.id);
                  setSelectedPlantingId(null);
                }}
              >
                {f.label} <span className="heroes-filter-n">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        <HeroesForest
          plantings={report.plantings}
          byUrbeno={h.byUrbeno}
          byClient={h.byClient}
          owed={h.owed}
          plantedAll={h.plantedAll}
          filter={forestFilter}
          selectedPlantingId={selectedPlantingId}
          onSelectPlanting={setSelectedPlantingId}
        />
      </section>

      <div className="heroes-metric-grid">
        <button type="button" className="heroes-metric-card blue" onClick={() => ledgerRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="heroes-metric-v">{num(co2Seq)}</span>
          <span className="heroes-metric-l">CO₂ sequestered (kg)</span>
          <span className="heroes-metric-s">Grows every day since planting</span>
        </button>
        <div className="heroes-metric-card">
          <span className="heroes-metric-v">{perDayDisplay.toFixed(2)}</span>
          <span className="heroes-metric-l">Absorbing now (kg/day)</span>
          <span className="heroes-metric-s">Live from all standing trees</span>
        </div>
        <div className="heroes-metric-card">
          <span className="heroes-metric-v">{num(seq.treeDays, 0)}</span>
          <span className="heroes-metric-l">Tree-days banked</span>
          <span className="heroes-metric-s">tree × days since planting</span>
        </div>
        <button
          type="button"
          className="heroes-metric-card"
          onClick={() => {
            setForestFilter('client');
            ledgerRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="heroes-metric-v">{growthPhotos}</span>
          <span className="heroes-metric-l">Growth photos</span>
          <span className="heroes-metric-s">CSR audit trail — add more anytime</span>
        </button>
      </div>

      <div className="card heroes-milestones">
        <div className="section-hd">Milestones — badge every {SUSTAINABILITY.heroMilestone} trees</div>
        <div className="heroes-badge-row">
          {h.badges.map((b, i) => (
            <div
              key={b.n}
              className={`hero-badge heroes-badge-interactive ${b.unlocked ? 'unlocked' : 'locked'}`}
              style={{ animationDelay: `${i * 0.06}s` }}
              title={b.unlocked ? `${b.n} trees unlocked` : `Unlock at ${b.n} trees`}
            >
              <div className="hero-badge-n">{b.n}</div>
              <div className="hero-badge-l">{b.unlocked ? 'trees' : 'locked'}</div>
            </div>
          ))}
        </div>
        <div className="heroes-progress-wrap">
          <div className="heroes-progress-labels">
            <span>Progress to {h.nextBadge} trees</span>
            <span>{h.toNext} to go</span>
          </div>
          <div className="bar heroes-progress-bar">
            <div
              className="bar-f heroes-progress-fill"
              style={{ width: `${Math.min(100, h.pctToNext)}%` }}
            />
            <div className="bar-t" style={{ color: h.pctToNext > 45 ? '#fff' : 'var(--g2)' }}>
              {h.pctToNext.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <PeriodPicker variant="card" value={period} onChange={setPeriod} />
      <div className="heroes-period-grid">
        <div className="heroes-period-stat">
          <span className="heroes-period-v">{h.tonnes.toFixed(2)}</span>
          <span className="heroes-period-l">Tonnes · {report.period.label || report.period.fy}</span>
        </div>
        <div className="heroes-period-stat">
          <span className="heroes-period-v">{h.earned}</span>
          <span className="heroes-period-l">Trees earned (1/tonne)</span>
        </div>
        <div className="heroes-period-stat">
          <span className="heroes-period-v">{h.planted}</span>
          <span className="heroes-period-l">Planted this period</span>
        </div>
        <div className="heroes-period-stat">
          <span className="heroes-period-v">{num(h.co2)}</span>
          <span className="heroes-period-l">Recycling CO₂e avoided (kg)</span>
        </div>
      </div>

      <div className="card heroes-ledger" ref={ledgerRef}>
        <div className="card-hd">
          <div className="card-ttl">Planting record &amp; growth audit</div>
          <div className="spacer" />
          <span className="dim" style={{ fontSize: '.76rem' }}>
            {filteredPlantings.length} of {report.plantings.length} planting
            {report.plantings.length !== 1 ? 's' : ''}
            {forestFilter !== 'all' ? ` · ${forestFilters.find((f) => f.id === forestFilter)?.label}` : ''}
          </span>
        </div>
        {!report.plantings.length ? (
          <div className="dim" style={{ fontSize: '.84rem', padding: '.5rem 0' }}>
            No plantings recorded yet. Trees are planted in batches at our partner sites.
          </div>
        ) : !filteredPlantings.length ? (
          <div className="dim" style={{ fontSize: '.84rem', padding: '.5rem 0' }}>
            {forestFilter === 'pending'
              ? 'Scheduled trees will appear here once the next Urbeno planting drive is recorded.'
              : 'No plantings match this filter.'}
          </div>
        ) : (
          filteredPlantings.map((t) => (
            <div
              key={t.id}
              data-planting-id={t.id}
              className={`heroes-tree-card-wrap${selectedPlantingId === t.id ? ' highlighted' : ''}`}
            >
              <TreeCard
                planting={t}
                canEdit={false}
                showClientCsrProgress
                clientVariant
                onAddProgress={setProgressFor}
              />
            </div>
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
          📄 Download the methodology document
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
