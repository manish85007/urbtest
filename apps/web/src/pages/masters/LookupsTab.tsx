import { useMemo, useState } from 'react';
import { dataApi, type LookupRow } from '../../api';
import { Modal } from '../../components/Modal';
import {
  LOOKUP_DEFS,
  canonicalLookupCategory,
  type LookupCol,
  type LookupDef,
} from '../../lib/lookup-defs';

interface LookupsTabProps {
  lookups: LookupRow[];
  onChanged: (msg: string) => void;
}

function cell(row: LookupRow, col: LookupCol): string {
  const v = row[col.k];
  if (v === undefined || v === null || v === '') return '—';
  return String(v);
}

export function LookupsTab({ lookups, onChanged }: LookupsTabProps) {
  const [editing, setEditing] = useState<{ def: LookupDef; row?: LookupRow } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, LookupRow[]>();
    for (const row of lookups) {
      const key = canonicalLookupCategory(row.category);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [lookups]);

  async function toggle(row: LookupRow, on: boolean) {
    await dataApi.upsertLookup({
      category: canonicalLookupCategory(row.category),
      id: row.id,
      label: row.label,
      active: on,
      rate: row.rate,
      description: row.description,
      days: row.days,
      code: row.code,
      phone: row.phone,
      gstin: row.gstin,
      transporterId: row.transporterId,
      address: row.address,
      gst: row.gst,
    });
    onChanged(on ? 'Lookup activated.' : 'Lookup deactivated.');
  }

  return (
    <>
      {LOOKUP_DEFS.map((def) => {
        const rows = grouped.get(def.key) ?? [];
        return (
          <div className="card" key={def.key}>
            <div className="card-hd">
              <div className="card-ttl">
                {def.name} ({rows.length})
              </div>
              <div className="spacer" />
              <button type="button" className="btn bs bsm" onClick={() => setEditing({ def })}>
                + Add
              </button>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    {def.cols.map((c) => (
                      <th key={c.k}>{c.h}</th>
                    ))}
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={r.active === false ? { opacity: 0.5 } : undefined}>
                      {def.cols.map((c) => (
                        <td key={c.k} className={c.k === 'code' ? 'mono' : undefined}>
                          {cell(r, c)}
                        </td>
                      ))}
                      <td>
                        {r.active !== false ? (
                          <span className="badge bg-g">Active</span>
                        ) : (
                          <span className="badge bg-gy">Off</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn bs bsm" onClick={() => setEditing({ def, row: r })}>
                          ✏️
                        </button>{' '}
                        <button
                          type="button"
                          className={`btn bsm ${r.active !== false ? 'brd' : 'bg-btn'}`}
                          onClick={() => void toggle(r, r.active === false)}
                        >
                          {r.active !== false ? 'Off' : 'On'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {def.note ? (
              <div
                style={{
                  marginTop: '.5rem',
                  padding: '.5rem .75rem',
                  background: 'var(--g5)',
                  borderRadius: 8,
                  fontSize: '.78rem',
                  color: 'var(--g2)',
                }}
              >
                {def.note}
              </div>
            ) : null}
          </div>
        );
      })}
      {editing ? (
        <LookupModal
          def={editing.def}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      ) : null}
    </>
  );
}

function LookupModal({
  def,
  row,
  onClose,
  onSaved,
}: {
  def: LookupDef;
  row?: LookupRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of def.cols) {
      const v = row?.[c.k];
      init[c.k] = v === undefined || v === null ? '' : String(v);
    }
    return init;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    const first = def.cols[0];
    if (first.required && !values[first.k]?.trim()) {
      setError(`${first.h} is required.`);
      return;
    }
    const body: Parameters<typeof dataApi.upsertLookup>[0] = {
      category: def.key,
      id: row?.id,
    };
    for (const c of def.cols) {
      const raw = values[c.k]?.trim() ?? '';
      if (c.kind === 'number') {
        (body as Record<string, unknown>)[c.k] = raw ? Number(raw) : 0;
      } else {
        (body as Record<string, unknown>)[c.k] = raw;
      }
    }
    if (!body.label && values.label) body.label = values.label;
    if (def.key === 'hsn' && values.code) body.label = values.code;
    setBusy(true);
    try {
      await dataApi.upsertLookup(body);
      onSaved(row ? 'Lookup updated.' : 'Lookup added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  const numberKeys = new Set(
    def.cols.filter((c) => c.kind === 'number' || c.k === 'gst' || c.k === 'rate' || c.k === 'days').map((c) => c.k),
  );

  return (
    <Modal
      title={row ? `Edit — ${def.name}` : `Add — ${def.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn bs" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn bp" disabled={busy} onClick={() => void save()}>
            {row ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      {def.cols.map((c) => (
        <div className="fg" key={c.k}>
          <label htmlFor={`lk-${c.k}`}>
            {c.h}
            {c.required ? ' *' : ''}
          </label>
          <input
            id={`lk-${c.k}`}
            type={numberKeys.has(c.k) ? 'number' : 'text'}
            step={numberKeys.has(c.k) ? 'any' : undefined}
            value={values[c.k] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [c.k]: e.target.value }))}
          />
        </div>
      ))}
    </Modal>
  );
}
