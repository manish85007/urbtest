import { num } from '../lib/format';

/** Animated SVG donut chart. */
export function DonutChart({
  slices,
  size = 180,
  centerLabel,
}: {
  slices: Array<{ value: number; color: string; label: string }>;
  size?: number;
  centerLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 38;
  const cx = 50;
  const cy = 50;
  let startAngle = -Math.PI / 2;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="client-chart-pie-wrap chart-pie-wrap">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill="#9ca3af">
          No data
        </text>
      </svg>
    );
  }

  const paths = slices.map((sl) => {
    const pct = sl.value / total;
    const sweep = 2 * Math.PI * pct;
    const endAngle = startAngle + sweep;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { d, color: sl.color, label: sl.label, pct, value: sl.value };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="client-chart-pie-wrap chart-pie-wrap">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.92} className="chart-pie-slice">
          <title>
            {p.label}: {p.value} ({(p.pct * 100).toFixed(0)}%)
          </title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={22} fill="white" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#27500A">
        {total}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="5.5" fill="#7d857a">
        {centerLabel ?? 'total'}
      </text>
    </svg>
  );
}

/** Animated horizontal bar chart. */
export function BarChart({
  bars,
  maxVal,
}: {
  bars: Array<{ label: string; value: number; color: string; unit?: string }>;
  maxVal: number;
}) {
  if (bars.length === 0) return null;
  const barH = 28;
  const gap = 10;

  return (
    <div style={{ width: '100%' }}>
      {bars.map((b, i) => {
        const pct = maxVal > 0 ? (b.value / maxVal) * 100 : 0;
        return (
          <div key={i} className="client-chart-bar chart-bar-row" style={{ marginBottom: gap }}>
            <div style={{ fontSize: '.78rem', color: 'var(--mu)', marginBottom: '.25rem', fontWeight: 600 }}>
              {b.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <div
                style={{
                  flex: 1,
                  height: barH,
                  background: '#f3f4f6',
                  borderRadius: 7,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="client-chart-bar-fill chart-bar-fill"
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: b.color,
                    animationDelay: `${0.1 + i * 0.15}s`,
                  }}
                />
              </div>
              <div style={{ minWidth: 48, textAlign: 'right', fontWeight: 800, fontSize: '.95rem', color: '#1c1b18' }}>
                {num(b.value, b.unit === 'kg' ? 0 : 1)}
                {b.unit ? ` ${b.unit}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Animated circular capacity gauge. */
export function CapacityRing({ pct, size = 120 }: { pct: number; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  const color = pct > 85 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="chart-capacity-ring">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 50 50)"
        className="chart-capacity-arc"
      />
      <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1c1b18">
        {pct.toFixed(1)}%
      </text>
      <text x="50" y="58" textAnchor="middle" fontSize="6" fill="#7d857a">
        capacity
      </text>
    </svg>
  );
}
