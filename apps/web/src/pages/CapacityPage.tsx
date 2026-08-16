import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_GROUPS, periodLabel, parseReportPeriod } from '@urb-tectrack/shared';
import { dataApi, type CapacityReport, type PeriodQuery, type SessionUser } from '../api';
import { PeriodPicker } from '../components/PeriodPicker';
import { num } from '../lib/format';

interface CapacityPageProps {
  user: SessionUser;
}

function Bar({ pct }: { pct: number }) {
  const n = Math.min(100, Math.max(0, pct));
  const color = pct >= 100 ? 'var(--rd)' : pct >= 80 ? 'var(--am)' : 'var(--g)';
  return (
    <div className="bar">
      <div className="bar-f" style={{ width: `${n}%`, background: color }} />
      <div className="bar-t">{pct.toFixed(1)}%</div>
    </div>
  );
}

export function CapacityPage({ user }: CapacityPageProps) {
  const [factories, setFactories] = useState<Array<{ id: string; name: string }>>([]);
  const [factoryId, setFactoryId] = useState('');
  const [period, setPeriod] = useState<PeriodQuery>({ period: 'fy' });
  const [report, setReport] = useState<CapacityReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dataApi
      .factories()
      .then((list) => {
        setFactories(list);
        const pick =
          user.role === 'factory' && user.factoryIds?.length
            ? user.factoryIds[0]
            : list[0]?.id ?? '';
        setFactoryId(pick);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load factories'));
  }, [user]);

  useEffect(() => {
    if (!factoryId) return;
    dataApi
      .capacity(factoryId, period)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load capacity'));
  }, [factoryId, period]);

  const byGroup = useMemo(() => {
    const map = new Map<
      string,
      { name: string; n: number; capKg: number; usedKg: number; ord: number }
    >();
    for (const e of report?.entries ?? []) {
      const meta = CATEGORY_GROUPS[e.groupCode as keyof typeof CATEGORY_GROUPS];
      const cur = map.get(e.groupCode) ?? {
        name: meta?.name ?? e.groupCode,
        n: 0,
        capKg: 0,
        usedKg: 0,
        ord: meta?.ord ?? 99,
      };
      cur.n += 1;
      cur.capKg += e.capKg;
      cur.usedKg += e.usedKg;
      map.set(e.groupCode, cur);
    }
    return [...map.entries()].sort((a, b) => a[1].ord - b[1].ord);
  }, [report]);

  const facName = factories.find((f) => f.id === factoryId)?.name || report?.factoryName || factoryId;
  const resolved = parseReportPeriod(period);
  const util = report?.stats.utilization ?? 0;
  const over = report?.stats.over ?? report?.entries.filter((e) => e.exceeded).length ?? 0;
  const warn = report?.stats.warn ?? report?.entries.filter((e) => e.atRisk).length ?? 0;

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <h1 className="h1">Capacity Utilization</h1>
          <div className="p-mu" style={{ margin: 0 }}>
            {facName} · authorized capacity vs processed · {report?.periodLabel || periodLabel(resolved)}
          </div>
        </div>
        <div className="spacer" />
        <select
          value={factoryId}
          onChange={(e) => setFactoryId(e.target.value)}
          style={{ padding: '.4rem .6rem', borderRadius: 8, border: '1px solid var(--bd)', fontFamily: 'inherit', fontSize: '.84rem' }}
        >
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <PeriodPicker value={period} onChange={setPeriod} />
        {user.role === 'admin' ? (
          <Link to="/masters?tab=cats" className="btn bs">
            ← Category Master
          </Link>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {report ? (
        <>
          <div className="stats" style={{ marginBottom: '1rem' }}>
            <div className="stat">
              <div className="stat-l">Authorized</div>
              <div className="stat-v">{num(report.stats.authorized / 1000)}</div>
              <div className="stat-t">TPA</div>
            </div>
            <div className="stat">
              <div className="stat-l">Processed</div>
              <div className="stat-v">{num(report.stats.processed / 1000)}</div>
              <div className="stat-t">tonnes</div>
            </div>
            <div className="stat">
              <div className="stat-l">Utilization</div>
              <div
                className="stat-v"
                style={{ color: util >= 80 ? 'var(--rd)' : util >= 50 ? 'var(--am)' : 'var(--g2)' }}
              >
                {util.toFixed(2)}%
              </div>
              <div className="stat-t">overall</div>
            </div>
            <div className="stat">
              <div className="stat-l">Entries at Risk</div>
              <div className="stat-v" style={{ color: report.stats.atRisk ? 'var(--rd)' : 'var(--g2)' }}>
                {report.stats.atRisk}
              </div>
              <div className="stat-t">
                {over} over · {warn} near
              </div>
            </div>
          </div>

          {report.alerts.length ? (
            <div className="card" style={{ background: 'var(--rd2)', borderColor: '#fecaca' }}>
              <div className="section-hd" style={{ borderColor: '#fecaca', color: 'var(--rd)' }}>
                🚨 Capacity Alerts
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Description</th>
                      <th>TPA</th>
                      <th>Used kg</th>
                      <th>Remaining</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.alerts.map((e) => (
                      <tr key={e.entryId}>
                        <td className="mono">
                          <b>{e.entryId}</b>
                        </td>
                        <td style={{ fontSize: '.8rem' }}>{e.description.slice(0, 50)}</td>
                        <td className="mono">{e.capacityTpa}</td>
                        <td className="mono">{num(e.usedKg)}</td>
                        <td className="mono">{num(e.remKg ?? Math.max(0, e.capKg - e.usedKg))}</td>
                        <td>
                          <span className={`badge ${e.exceeded ? 'bg-rd' : 'bg-am'}`}>{e.pct.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="card" style={{ padding: '.4rem' }}>
            <div style={{ padding: '.4rem .6rem', fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)' }}>
              By Material Group
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Group</th>
                    <th>Entries</th>
                    <th style={{ textAlign: 'right' }}>TPA</th>
                    <th style={{ textAlign: 'right' }}>Used (t)</th>
                    <th style={{ minWidth: 160 }}>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {byGroup.map(([code, g]) => (
                    <tr key={code}>
                      <td className="mono">
                        <b>{code}</b>
                      </td>
                      <td>{g.name}</td>
                      <td className="mono">{g.n}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(g.capKg / 1000)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(g.usedKg / 1000)}
                      </td>
                      <td>
                        <Bar pct={g.capKg > 0 ? (g.usedKg / g.capKg) * 100 : 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: '.4rem' }}>
            <div style={{ padding: '.4rem .6rem', fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)' }}>
              Top entries by utilization
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Description</th>
                    <th>Group</th>
                    <th style={{ textAlign: 'right' }}>TPA</th>
                    <th style={{ textAlign: 'right' }}>Used kg</th>
                    <th style={{ minWidth: 140 }}>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.slice(0, 25).map((e) => (
                    <tr key={e.entryId}>
                      <td className="mono">
                        <b>{e.entryId}</b>
                      </td>
                      <td className="dim" style={{ fontSize: '.8rem' }}>
                        {e.description.slice(0, 45)}
                      </td>
                      <td>
                        <span className="badge bg-bl">{e.groupCode}</span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {e.capacityTpa}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(e.usedKg)}
                      </td>
                      <td>
                        <Bar pct={e.pct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}
