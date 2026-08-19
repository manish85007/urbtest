import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_GROUPS,
  formatForm6Number,
  getFY,
  matTotal,
  recoveryFor,
  round2,
  type MaterialGroupCode,
} from '@urb-tectrack/shared';
import { dataApi, type CategorySummary, type VehicleDetail } from '../api';
import { FileUpload } from './FileUpload';
import { num } from '../lib/format';

const GROUPS: MaterialGroupCode[] = ['ITEW', 'CEEW', 'LSEEW', 'EETW', 'TLSEW', 'MDW', 'LIW'];

function asGroup(code: string): MaterialGroupCode {
  return GROUPS.includes(code as MaterialGroupCode) ? (code as MaterialGroupCode) : 'ITEW';
}

type SplitRow = { entryId: string; kg: string; hint?: string };
type Recovery = { fe: number; nfe: number; pl: number; pcb: number };

interface RecyclingFormProps {
  formId?: string;
  lockedFactoryId: string;
  invoiceNo: string;
  billingWeight: number;
  invoiceQty?: number;
  ewayBillNo?: string;
  vehicles: VehicleDetail[];
  seedHints?: Array<{ name: string; qty: number; weightKg: number }>;
  initial?: {
    processedAt?: string;
    factoryId?: string;
    devicesDestroyed?: number;
    vehicleIds?: string[];
    photoIds?: string[];
    reportIds?: string[];
    categories?: Array<{
      entryId: string;
      groupCode: string;
      weightKg: number;
      recoveryFe?: number;
      recoveryNfe?: number;
      recoveryPl?: number;
      recoveryPcb?: number;
    }>;
  };
  disabled: boolean;
  onSubmit: (body: {
    processedAt: string;
    factoryId?: string;
    devicesDestroyed?: number;
    categories: Array<{
      entryId: string;
      groupCode: string;
      weightKg: number;
      recoveryFe?: number;
      recoveryNfe?: number;
      recoveryPl?: number;
      recoveryPcb?: number;
      overrideReason?: string;
    }>;
    photoIds?: string[];
    reportIds?: string[];
    vehicleIds: string[];
  }) => void;
}

export function RecyclingForm({
  formId,
  lockedFactoryId,
  invoiceNo,
  billingWeight,
  invoiceQty = 0,
  ewayBillNo,
  vehicles,
  seedHints,
  initial,
  disabled,
  onSubmit,
}: RecyclingFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const target = round2(billingWeight);
  const [factoryName, setFactoryName] = useState(lockedFactoryId);
  const [processedAt, setProcessedAt] = useState(initial?.processedAt || today);
  const [dest, setDest] = useState(
    String(initial?.devicesDestroyed ?? (seedHints?.reduce((s, m) => s + (m.qty || 0), 0) || invoiceQty || 0)),
  );
  const [vehicleIds, setVehicleIds] = useState<string[]>(() =>
    initial?.vehicleIds?.length ? initial.vehicleIds : vehicles.map((v) => v.id),
  );
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [rows, setRows] = useState<SplitRow[]>(() =>
    initial?.categories?.length
      ? initial.categories.map((c) => ({ entryId: c.entryId, kg: String(c.weightKg) }))
      : [{ entryId: '', kg: String(target || ''), hint: seedHints?.[0]?.name }],
  );
  const [recovery, setRecovery] = useState<Record<string, Recovery>>(() => {
    const out: Record<string, Recovery> = {};
    for (const c of initial?.categories ?? []) {
      out[c.entryId] = {
        fe: c.recoveryFe ?? 0,
        nfe: c.recoveryNfe ?? 0,
        pl: c.recoveryPl ?? 0,
        pcb: c.recoveryPcb ?? 0,
      };
    }
    return out;
  });
  const [overrideReason, setOverrideReason] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>(initial?.photoIds ?? []);
  const [reportIds, setReportIds] = useState<string[]>(initial?.reportIds ?? []);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lockedFactoryId) return;
    dataApi.categories(lockedFactoryId).then((cats) => {
      setCategories(cats);
      const first = cats[0]?.entryId ?? '';
      setRows((prev) => {
        if (!first) return prev;
        if (prev.some((r) => r.entryId)) {
          return prev.map((r) =>
            r.entryId && cats.some((c) => c.entryId === r.entryId) ? r : { ...r, entryId: first },
          );
        }
        if (prev.length === 1 && !prev[0].entryId) {
          return [{ ...prev[0], entryId: first, kg: prev[0].kg || String(target || '') }];
        }
        return prev.map((r) =>
          r.entryId && cats.some((c) => c.entryId === r.entryId) ? r : { ...r, entryId: first },
        );
      });
    });
    dataApi.factories().then((list) => {
      const match = list.find((f) => f.id === lockedFactoryId);
      setFactoryName(match?.name ?? lockedFactoryId);
    });
  }, [lockedFactoryId, target]);

  const grouped = useMemo(() => {
    const map = new Map<string, CategorySummary[]>();
    for (const c of categories) {
      const list = map.get(c.groupCode) ?? [];
      list.push(c);
      map.set(c.groupCode, list);
    }
    return [...map.entries()];
  }, [categories]);

  const splitSum = round2(rows.reduce((s, r) => s + (parseFloat(r.kg) || 0), 0));
  const splitDiff = round2(target - splitSum);
  const splitOk = Math.abs(splitDiff) < 0.01;

  const merged = useMemo(() => {
    const out: Array<{ entryId: string; kg: number; groupCode: MaterialGroupCode; desc: string }> = [];
    for (const r of rows) {
      if (!r.entryId || !(parseFloat(r.kg) > 0)) continue;
      const cm = categories.find((c) => c.entryId === r.entryId);
      const kg = parseFloat(r.kg) || 0;
      const ex = out.find((x) => x.entryId === r.entryId);
      if (ex) ex.kg += kg;
      else {
        out.push({
          entryId: r.entryId,
          kg,
          groupCode: asGroup(cm?.groupCode ?? 'ITEW'),
          desc: cm?.description ?? r.entryId,
        });
      }
    }
    return out;
  }, [rows, categories]);

  const recoveryRows = merged.map((x) => {
    const prev = recovery[x.entryId];
    const seededMat = prev && Math.abs(matTotal(prev) - x.kg) < 0.05 ? prev : recoveryFor(x.groupCode, x.kg);
    return { ...x, mat: seededMat };
  });

  const allRecoveryOk = recoveryRows.every((x) => Math.abs(round2(matTotal(x.mat)) - round2(x.kg)) < 0.05);

  function setRow(i: number, patch: Partial<SplitRow>) {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function balanceSplit() {
    if (!rows.length) return;
    const last = rows.length - 1;
    const others = rows.slice(0, last).reduce((s, r) => s + (parseFloat(r.kg) || 0), 0);
    const next = Math.max(0, round2(target - others));
    setRow(last, { kg: next.toFixed(2) });
  }

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!vehicleIds.length) {
          setError('Select at least one vehicle to print on this Form 6.');
          return;
        }
        if (!merged.length) {
          setError('Split the received material into at least one authorised category.');
          return;
        }
        if (rows.some((r) => !r.entryId)) {
          setError('Every category line needs a category selected. Remove any blank lines.');
          return;
        }
        if (rows.some((r) => !(parseFloat(r.kg) > 0))) {
          setError('Every category line needs a weight greater than zero.');
          return;
        }
        if (!splitOk) {
          setError(
            `The category split totals ${num(splitSum)} kg against ${num(target)} kg on this invoice. Use “Balance to ${num(target)} kg” or adjust the lines so every kilogram is accounted for.`,
          );
          return;
        }
        if (!allRecoveryOk) {
          setError('Recovery fractions on each category must account for the whole category weight.');
          return;
        }
        onSubmit({
          processedAt,
          factoryId: lockedFactoryId,
          devicesDestroyed: parseInt(dest, 10) || 0,
          photoIds: photoIds.length ? photoIds : undefined,
          reportIds: reportIds.length ? reportIds : undefined,
          vehicleIds,
          categories: recoveryRows.map((c) => ({
            entryId: c.entryId,
            groupCode: c.groupCode,
            weightKg: round2(c.kg),
            recoveryFe: c.mat.fe,
            recoveryNfe: c.mat.nfe,
            recoveryPl: c.mat.pl,
            recoveryPcb: c.mat.pcb,
            ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
          })),
        });
      }}
    >
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.7rem' }}>
        Form 6 is issued per invoice. Weight and quantity come from invoice {invoiceNo}. Select the vehicles
        that belong on this manifest.
      </p>
      <div style={{ background: 'var(--g3)', padding: '.5rem .8rem', borderRadius: 8, fontSize: '.8rem', marginBottom: '.8rem' }}>
        Form 6 number: <b className="mono">{getFY(processedAt) ? formatForm6Number(getFY(processedAt)!.short, 0).replace(/0000$/, '[next]') : '—'}</b>
        <div style={{ marginTop: '.2rem' }}>
          Invoice <b className="mono">{invoiceNo}</b> · billed <b>{num(target)} kg</b>
          {invoiceQty ? (
            <>
              {' '}
              · qty <b>{invoiceQty}</b>
            </>
          ) : null}
          {ewayBillNo ? (
            <>
              {' '}
              · E-way bill: <b className="mono">{ewayBillNo}</b>
            </>
          ) : null}
        </div>
        <div className="dim" style={{ fontSize: '.73rem', marginTop: '.15rem' }}>
          Number format F6/[FY]/[0001] — resets each April
        </div>
      </div>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="rc-dt">Processing Date</label>
          <input id="rc-dt" type="date" value={processedAt} onChange={(e) => setProcessedAt(e.target.value)} required />
        </div>
        <div className="fg">
          <label htmlFor="rc-fac">Facility</label>
          <div className="tile" style={{ marginTop: '.15rem' }}>
            <div className="tile-v">{factoryName}</div>
            <div className="dim mono" style={{ fontSize: '.72rem' }}>
              {lockedFactoryId} · fixed from MRN
            </div>
          </div>
          <div className="dim" style={{ fontSize: '.71rem', marginTop: '.2rem' }}>
            Categories below are the lines authorised for this facility
          </div>
        </div>
        <div className="fg">
          <label htmlFor="rc-dest">Devices Destroyed</label>
          <input id="rc-dest" type="number" min={0} value={dest} onChange={(e) => setDest(e.target.value)} required />
        </div>
      </div>

      <div className="section-hd" style={{ marginTop: '.4rem' }}>
        Vehicles on this Form 6
      </div>
      <div className="tw" style={{ marginBottom: '.6rem' }}>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Vehicle</th>
              <th>Driver</th>
              <th>Net kg</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={vehicleIds.includes(v.id)}
                    onChange={(e) =>
                      setVehicleIds((cur) =>
                        e.target.checked ? [...cur, v.id] : cur.filter((id) => id !== v.id),
                      )
                    }
                  />
                </td>
                <td className="mono">{v.registration}</td>
                <td>{v.driverName}</td>
                <td className="mono">{v.weighment ? num(Number(v.weighment.netKg)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-hd" style={{ marginTop: '.4rem' }}>
        Category Split{' '}
        <span className="hint" style={{ fontWeight: 400 }}>
          every kilogram on this invoice must land in an authorised category
        </span>
      </div>
      {rows.map((row, i) => (
        <div key={i}>
          <div
            className="rc-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 100px 34px',
              gap: '.4rem',
              marginBottom: '.3rem',
              alignItems: 'center',
              padding: '.3rem',
              background: i % 2 ? 'var(--g5)' : '#fff',
              border: '1px solid var(--bd)',
              borderRadius: 6,
            }}
          >
            <select
              className="rc-c"
              style={{ fontSize: '.78rem' }}
              value={row.entryId}
              onChange={(e) => setRow(i, { entryId: e.target.value })}
              required
            >
              <option value="">— select category —</option>
              {grouped.map(([g, list]) => (
                <optgroup key={g} label={`${g} — ${CATEGORY_GROUPS[g as MaterialGroupCode]?.name ?? g}`}>
                  {list.map((c) => (
                    <option key={c.entryId} value={c.entryId}>
                      {c.entryId} — {c.description.slice(0, 55)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              className="rc-w"
              value={row.kg}
              placeholder="kg"
              style={{ fontSize: '.8rem' }}
              onChange={(e) => setRow(i, { kg: e.target.value })}
              required
            />
            <button
              type="button"
              className="btn brd bsm"
              onClick={() => setRows((cur) => (cur.length <= 1 ? cur : cur.filter((_, j) => j !== i)))}
            >
              ×
            </button>
          </div>
          {row.hint ? (
            <div className="dim" style={{ fontSize: '.7rem', margin: '-.15rem 0 .3rem .3rem' }}>
              from consignment line: {row.hint}
            </div>
          ) : null}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '.3rem' }}>
        <button type="button" className="btn bs bsm" onClick={() => setRows((cur) => [...cur, { entryId: '', kg: '' }])}>
          + Add category line
        </button>
        <button type="button" className="btn bs bsm" onClick={balanceSplit}>
          ⚖️ Balance to {num(target)} kg
        </button>
        <div className="spacer" />
        <div className={`balance-box ${splitOk ? 'balance-ok' : 'balance-bad'}`} style={{ margin: 0, minWidth: 230 }}>
          {splitOk ? (
            <>
              <span>
                Split <b>{num(splitSum)} kg</b>
              </span>
              <span>✓ Accounts for the full invoice</span>
            </>
          ) : (
            <>
              <span>
                Split <b>{num(splitSum)} kg</b>
              </span>
              <span>
                of <b>{num(target)} kg</b> · {splitDiff > 0 ? `${num(splitDiff)} kg unallocated` : `${num(-splitDiff)} kg over`}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="section-hd" style={{ marginTop: '.6rem' }}>
        Material Recovery by Category{' '}
        <span className="hint" style={{ fontWeight: 400 }}>
          seeded from each category&apos;s material group — adjust to actual yield
        </span>
      </div>
      {!recoveryRows.length ? (
        <div className="dim" style={{ fontSize: '.8rem' }}>
          Assign categories and weights above — recovery is derived from them.
        </div>
      ) : (
        recoveryRows.map((x, i) => {
          const tot = round2(matTotal(x.mat));
          const ok = Math.abs(tot - round2(x.kg)) < 0.05;
          return (
            <div
              key={x.entryId}
              className="rc-mat"
              style={{
                padding: '.4rem',
                border: '1px solid var(--bd)',
                borderRadius: 6,
                marginBottom: '.3rem',
                background: i % 2 ? 'var(--g5)' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.3rem' }}>
                <b className="mono" style={{ fontSize: '.8rem' }}>
                  {x.entryId}
                </b>
                <span className="dim" style={{ fontSize: '.75rem' }}>
                  {x.desc.slice(0, 48)} · {num(x.kg)} kg
                </span>
                <div className="spacer" />
                <span className={`badge ${ok ? 'bg-g' : 'bg-rd'}`}>{ok ? '✓' : `${num(tot)} / ${num(x.kg)} kg`}</span>
              </div>
              <div className="fr4">
                {(
                  [
                    ['fe', 'Fe'],
                    ['nfe', 'NFe'],
                    ['pl', 'Plastics'],
                    ['pcb', 'PCB'],
                  ] as const
                ).map(([k, label]) => (
                  <div className="fg" key={k}>
                    <label>{label} kg</label>
                    <input
                      type="number"
                      step="0.01"
                      value={x.mat[k]}
                      onChange={(e) =>
                        setRecovery((prev) => ({
                          ...prev,
                          [x.entryId]: { ...x.mat, [k]: parseFloat(e.target.value) || 0 },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      <div className={`balance-box ${allRecoveryOk && recoveryRows.length ? 'balance-ok' : 'balance-bad'}`}>
        {allRecoveryOk && recoveryRows.length
          ? 'Recovery fractions account for every kilogram in each category.'
          : 'Adjust Fe / NFe / plastics / PCB so each category sums to its split weight.'}
      </div>

      <div className="fg" style={{ marginTop: '.5rem' }}>
        <label htmlFor="rc-ovr">Capacity override reason</label>
        <input
          id="rc-ovr"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Required only if category TPA would be exceeded"
        />
      </div>

      <div className="section-hd" style={{ marginTop: '.7rem' }}>
        Processing Evidence{' '}
        <span className="hint" style={{ fontWeight: 400 }}>
          segregation and dismantling photos · max 5 MB each
        </span>
      </div>
      <FileUpload
        kind="processing"
        label="Processing photos"
        accept="image/*"
        disabled={disabled}
        value={photoIds}
        onChange={setPhotoIds}
      />
      <div className="section-hd" style={{ marginTop: '.6rem' }}>
        Process / Lab Reports <span className="hint" style={{ fontWeight: 400 }}>optional — PDF</span>
      </div>
      <FileUpload
        kind="report"
        label="Lab / process reports"
        accept="application/pdf"
        disabled={disabled}
        value={reportIds}
        onChange={setReportIds}
      />

      {error ? <p className="error">{error}</p> : null}
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          Issue Form 6
        </button>
      )}
    </form>
  );
}
