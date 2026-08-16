import { listFiscalYears, periodLabel, parseReportPeriod } from '@urb-tectrack/shared';
import type { PeriodQuery } from '../api';

export function PeriodPicker({
  value,
  onChange,
  variant = 'inline',
}: {
  value: PeriodQuery;
  onChange: (next: PeriodQuery) => void;
  variant?: 'inline' | 'card';
}) {
  const fys = listFiscalYears(2024);
  const kind = value.period ?? 'fy';
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const resolved = parseReportPeriod(value);

  const fields = (
    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="fg" style={{ margin: 0, minWidth: 150 }}>
        <label htmlFor="period-basis">Basis</label>
        <select
          id="period-basis"
          value={kind}
          onChange={(e) => onChange({ ...value, period: e.target.value })}
        >
          <option value="fy">Financial Year (Apr–Mar)</option>
          <option value="calendar">Calendar Year (Jan–Dec)</option>
          <option value="custom">Custom period</option>
          <option value="all">All time</option>
        </select>
      </div>
      {kind === 'fy' ? (
        <div className="fg" style={{ margin: 0, minWidth: 140 }}>
          <label htmlFor="period-fy">Financial Year</label>
          <select
            id="period-fy"
            value={value.fy ?? fys[0]?.label ?? ''}
            onChange={(e) => onChange({ ...value, fy: e.target.value })}
          >
            {fys.map((fy) => (
              <option key={fy.short} value={fy.label}>
                {fy.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {kind === 'calendar' ? (
        <div className="fg" style={{ margin: 0, minWidth: 120 }}>
          <label htmlFor="period-year">Calendar Year</label>
          <select
            id="period-year"
            value={value.year ?? String(new Date().getFullYear())}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {kind === 'custom' ? (
        <>
          <div className="fg" style={{ margin: 0 }}>
            <label htmlFor="period-from">From</label>
            <input
              id="period-from"
              type="date"
              value={value.from ?? ''}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </div>
          <div className="fg" style={{ margin: 0 }}>
            <label htmlFor="period-to">To</label>
            <input
              id="period-to"
              type="date"
              value={value.to ?? ''}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </div>
        </>
      ) : null}
      {variant === 'card' ? (
        <>
          <div className="spacer" />
          <span className="badge bg-g" style={{ padding: '.35rem .6rem' }}>
            {periodLabel(resolved)}
          </span>
        </>
      ) : null}
    </div>
  );

  if (variant === 'card') {
    return (
      <div className="card">
        <div className="section-hd">Reporting Period</div>
        {fields}
      </div>
    );
  }

  return <div className="fr3" style={{ alignItems: 'end' }}>{fields}</div>;
}
