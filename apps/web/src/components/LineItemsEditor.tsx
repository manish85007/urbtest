export type DraftLine = { n: string; q: string; w: string; hsn: string };

export const EMPTY_LINE: DraftLine = { n: '', q: '', w: '', hsn: '854890' };

export function LineItemsEditor({
  items,
  onChange,
  hint,
}: {
  items: DraftLine[];
  onChange: (items: DraftLine[]) => void;
  hint?: string;
}) {
  function patch(i: number, field: keyof DraftLine, value: string) {
    onChange(items.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [{ ...EMPTY_LINE }]);
  }

  return (
    <>
      <div className="section-hd" style={{ marginTop: '.7rem' }}>
        Line Items{hint ? <span className="hint" style={{ fontWeight: 400 }}> {hint}</span> : null}
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          className="ns-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 70px 90px 80px 34px',
            gap: '.35rem',
            marginBottom: '.3rem',
          }}
        >
          <input
            type="text"
            placeholder="Item description"
            value={it.n}
            onChange={(e) => patch(i, 'n', e.target.value)}
          />
          <input
            type="number"
            placeholder="Qty"
            value={it.q}
            onChange={(e) => patch(i, 'q', e.target.value)}
          />
          <input
            type="number"
            step="0.1"
            placeholder="kg"
            value={it.w}
            onChange={(e) => patch(i, 'w', e.target.value)}
          />
          <input
            type="text"
            placeholder="HSN"
            value={it.hsn}
            onChange={(e) => patch(i, 'hsn', e.target.value)}
          />
          <button type="button" className="btn brd bsm" onClick={() => remove(i)} aria-label="Remove line">
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn bs bsm"
        onClick={() => onChange([...items, { ...EMPTY_LINE }])}
      >
        + Add line
      </button>
    </>
  );
}

export function namedDraftLines(items: DraftLine[]) {
  return items
    .map((row) => ({
      name: row.n.trim(),
      qty: parseInt(row.q, 10) || 0,
      weightKg: parseFloat(row.w) || 0,
      hsn: row.hsn.trim() || '854890',
    }))
    .filter((row) => row.name);
}
