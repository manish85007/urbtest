import { listFiscalYears } from '@urb-tectrack/shared';
import type { PeriodQuery } from '../api';

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodQuery;
  onChange: (next: PeriodQuery) => void;
}) {
  const fys = listFiscalYears(2024);
  const kind = value.period ?? 'fy';

  return (
    <div className="fr3" style={{ alignItems: 'end' }}>
      <label>
        Period
        <select
          value={kind}
          onChange={(e) => onChange({ ...value, period: e.target.value })}
        >
          <option value="fy">Financial year</option>
          <option value="calendar">Calendar year</option>
          <option value="custom">Custom range</option>
          <option value="all">All time</option>
        </select>
      </label>
      {kind === 'fy' ? (
        <label>
          FY
          <select value={value.fy ?? fys[0]?.label ?? ''} onChange={(e) => onChange({ ...value, fy: e.target.value })}>
            {fys.map((fy) => (
              <option key={fy.short} value={fy.label}>
                {fy.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === 'calendar' ? (
        <label>
          Year
          <input
            type="number"
            value={value.year ?? String(new Date().getFullYear())}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
          />
        </label>
      ) : null}
      {kind === 'custom' ? (
        <>
          <label>
            From
            <input type="date" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
