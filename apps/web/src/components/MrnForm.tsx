import { useEffect, useMemo, useState } from 'react';
import { formatMrnNumber, getFY } from '@urb-tectrack/shared';
import { dataApi, type InvoiceDetail, type VehicleDetail } from '../api';
import { FileUpload } from './FileUpload';
import { num } from '../lib/format';

type LineSeed = { name: string; qty: number; weightKg: string | number };

interface MrnFormProps {
  formId?: string;
  invoice: InvoiceDetail;
  vehicles: VehicleDetail[];
  lineItems: LineSeed[];
  userName: string;
  disabled: boolean;
  mode?: 'create' | 'edit';
  onSubmit: (body: {
    factoryId: string;
    receivedAt: string;
    driverSign: string;
    managerSign: string;
    securitySign: string;
    materials: Array<{ name: string; qty: number; weight: number }>;
    condition: string;
    note?: string;
    gatePhotoIds: string[];
    materialPhotoIds: string[];
  }) => void;
}

type MatRow = { name: string; qty: string; weight: string };

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function seedMaterialRows(invoice: InvoiceDetail, lineItems: LineSeed[]): MatRow[] {
  if (invoice.mrn?.materials?.length) {
    return invoice.mrn.materials.map((m) => ({
      name: String(m.n ?? ''),
      qty: m.q == null ? '' : String(m.q),
      weight: m.w == null ? '' : String(m.w),
    }));
  }
  const billed = Number(invoice.billingWeight) || 0;
  const source = lineItems.length
    ? lineItems
    : [{ name: 'Material as invoiced', qty: 1, weightKg: billed }];
  const weights = source.map((it) => Number(it.weightKg) || 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (billed > 0 && sum > 0 && Math.abs(sum - billed) >= 0.001) {
    let allocated = 0;
    return source.map((it, i) => {
      const w = i === source.length - 1 ? round3(billed - allocated) : round3((weights[i] / sum) * billed);
      allocated = round3(allocated + w);
      return { name: it.name, qty: String(it.qty || ''), weight: String(w) };
    });
  }
  if (billed > 0 && sum === 0) {
    return source.map((it, i) => ({
      name: it.name,
      qty: String(it.qty || ''),
      weight: i === 0 ? String(billed) : '0',
    }));
  }
  return source.map((it) => ({
    name: it.name,
    qty: String(it.qty || ''),
    weight: it.weightKg === '' || it.weightKg == null ? '' : String(it.weightKg),
  }));
}

export function MrnForm({
  formId,
  invoice,
  vehicles,
  lineItems,
  userName,
  disabled,
  mode = 'create',
  onSubmit,
}: MrnFormProps) {
  const editing = mode === 'edit' && !!invoice.mrn;
  const today = new Date().toISOString().slice(0, 10);
  const invoiceVehs = vehicles.filter(
    (v) => !invoice.vehicleIds?.length || invoice.vehicleIds.includes(v.id),
  );
  const billedKg = Number(invoice.billingWeight) || 0;
  const [factories, setFactories] = useState<Array<{ id: string; name: string }>>([]);
  const [factoryId, setFactoryId] = useState(invoice.mrn?.factoryId ?? 'URB-BLR');
  const [receivedAt, setReceivedAt] = useState(invoice.mrn?.receivedAt?.slice(0, 10) || today);
  const [condition, setCondition] = useState(invoice.mrn?.condition || 'Good');
  const [note, setNote] = useState('');
  const [driverSign, setDriverSign] = useState(invoice.mrn?.driverSign || invoiceVehs[0]?.driverName || '');
  const [managerSign, setManagerSign] = useState(invoice.mrn?.managerSign || userName);
  const [securitySign, setSecuritySign] = useState(invoice.mrn?.securitySign || '');
  const [gatePhotoIds, setGatePhotoIds] = useState<string[]>(invoice.mrn?.gatePhotoIds ?? []);
  const [materialPhotoIds, setMaterialPhotoIds] = useState<string[]>(invoice.mrn?.materialPhotoIds ?? []);
  const [error, setError] = useState('');
  const [mats, setMats] = useState<MatRow[]>(() => seedMaterialRows(invoice, lineItems));

  useEffect(() => {
    dataApi.factories().then((list) => {
      setFactories(list);
      if (list[0] && !list.some((f) => f.id === factoryId)) setFactoryId(list[0].id);
    });
  }, [factoryId]);

  const preview = useMemo(() => {
    if (editing && invoice.mrn?.mrnNo) return invoice.mrn.mrnNo;
    const fy = getFY(receivedAt);
    return fy ? formatMrnNumber(factoryId, fy.short, 0).replace(/0000$/, '[next]') : '—';
  }, [editing, invoice.mrn?.mrnNo, factoryId, receivedAt]);

  const netTotal = invoiceVehs.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);
  const receivedKg = round3(mats.reduce((s, m) => s + (Number(m.weight) || 0), 0));
  const weightMatch = Math.abs(receivedKg - billedKg) < 0.001;

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        const materials = mats
          .map((m) => ({
            name: m.name.trim(),
            qty: Number(m.qty) || 0,
            weight: Number(m.weight) || 0,
          }))
          .filter((m) => m.name);
        if (!materials.length) {
          setError('Record at least one material line counted at the gate.');
          return;
        }
        const total = round3(materials.reduce((s, m) => s + m.weight, 0));
        if (Math.abs(total - billedKg) >= 0.001) {
          setError(
            `Material received (${num(total)} kg) must equal invoice ${invoice.invoiceNo} billing weight (${num(billedKg)} kg).`,
          );
          return;
        }
        if (invoiceVehs.some((v) => !v.weighment)) {
          setError('Every vehicle on this invoice must have a recorded weighment before the MRN can be raised.');
          return;
        }
        if (!driverSign.trim() || !managerSign.trim() || !securitySign.trim()) {
          setError('All three signatures are required on the gate document.');
          return;
        }
        if (!gatePhotoIds.length) {
          setError('Upload at least one photograph of the vehicle at the gate.');
          return;
        }
        if (!materialPhotoIds.length) {
          setError('Upload at least one photograph of the material inside the vehicle.');
          return;
        }
        onSubmit({
          factoryId,
          receivedAt,
          driverSign: driverSign.trim(),
          managerSign: managerSign.trim(),
          securitySign: securitySign.trim(),
          materials,
          condition: condition.trim() || 'Good',
          note: note.trim() || undefined,
          gatePhotoIds,
          materialPhotoIds,
        });
      }}
    >
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.7rem' }}>
        This MRN is linked only to invoice <b className="mono">{invoice.invoiceNo}</b>. Each invoice on the
        request needs its own goods receipt. Material received must equal the billed weight of{' '}
        <b>{num(billedKg)} kg</b>.
      </p>
      <div style={{ background: 'var(--g3)', padding: '.5rem .8rem', borderRadius: 8, fontSize: '.83rem', marginBottom: '.8rem' }}>
        MRN number: <b className="mono">{preview}</b>
        {editing ? (
          <div className="dim" style={{ fontSize: '.73rem', marginTop: '.15rem' }}>
            Number stays the same when correcting an existing note
          </div>
        ) : (
          <div className="dim" style={{ fontSize: '.73rem', marginTop: '.15rem' }}>
            Format MRN/[Factory]/[FY]/[Sequence] — resets each April
          </div>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
          gap: '.45rem',
          marginBottom: '.8rem',
        }}
      >
        <div className="tile">
          <div className="tile-l">Linked invoice</div>
          <div className="tile-v mono">{invoice.invoiceNo}</div>
        </div>
        <div className="tile">
          <div className="tile-l">Invoice billed kg</div>
          <div className="tile-v mono">{num(billedKg)}</div>
        </div>
        <div className="tile">
          <div className="tile-l">Material received kg</div>
          <div className="tile-v mono" style={{ color: weightMatch ? 'inherit' : 'var(--rd, #b42318)' }}>
            {num(receivedKg)}
          </div>
        </div>
      </div>
      {!weightMatch ? (
        <p className="error" style={{ marginTop: '-.4rem' }}>
          Received weight must match billed weight exactly before this MRN can be saved.
        </p>
      ) : null}
      <div className="fr2">
        <div className="fg">
          <label htmlFor="mr-fac">Factory Site</label>
          <select
            id="mr-fac"
            value={factoryId}
            onChange={(e) => setFactoryId(e.target.value)}
            required
            disabled={editing}
          >
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.id})
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="mr-dt">Receiving Date</label>
          <input id="mr-dt" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
        </div>
      </div>

      <div className="section-hd" style={{ marginTop: '.4rem' }}>
        Vehicles &amp; Weighment on this invoice
      </div>
      <div className="tw" style={{ marginBottom: '.6rem' }}>
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Driver</th>
              <th>Gross</th>
              <th>Tare</th>
              <th>Net</th>
              <th>Slip</th>
            </tr>
          </thead>
          <tbody>
            {invoiceVehs.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.registration}</td>
                <td>{v.driverName}</td>
                <td className="mono">{v.weighment ? num(Number(v.weighment.grossKg ?? 0)) : '—'}</td>
                <td className="mono">{v.weighment ? num(Number(v.weighment.tareKg ?? 0)) : '—'}</td>
                <td className="mono">
                  <b>{v.weighment ? num(Number(v.weighment.netKg)) : '—'}</b>
                </td>
                <td className="mono dim">{v.weighment?.slipNumber || '—'}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--g3)', fontWeight: 700 }}>
              <td colSpan={4}>Total net received</td>
              <td className="mono">{num(netTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section-hd">
        Materials Received{' '}
        <span className="hint" style={{ fontWeight: 400 }}>
          total must equal {num(billedKg)} kg billed on {invoice.invoiceNo}
        </span>
      </div>
      {mats.map((row, i) => (
        <div
          className="mr-row"
          key={i}
          style={{ display: 'grid', gridTemplateColumns: '3fr 90px 110px 34px', gap: '.35rem', marginBottom: '.3rem', alignItems: 'center' }}
        >
          <input
            type="text"
            className="mr-n"
            placeholder="Description"
            value={row.name}
            onChange={(e) => setMats((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
          />
          <input
            type="number"
            className="mr-q"
            placeholder="Qty"
            value={row.qty}
            onChange={(e) => setMats((rows) => rows.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))}
          />
          <input
            type="number"
            step="0.001"
            className="mr-w"
            placeholder="Weight kg"
            value={row.weight}
            onChange={(e) => setMats((rows) => rows.map((r, j) => (j === i ? { ...r, weight: e.target.value } : r)))}
          />
          <button
            type="button"
            className="btn brd bsm"
            onClick={() => setMats((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== i)))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn bs bsm"
        onClick={() => setMats((rows) => [...rows, { name: '', qty: '', weight: '' }])}
      >
        + Add material line
      </button>

      <div className="fg" style={{ marginTop: '.5rem' }}>
        <label htmlFor="mr-cond">Condition on Arrival</label>
        <input
          id="mr-cond"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          required
          placeholder="e.g. Good — packaging intact"
        />
      </div>

      <div className="section-hd" style={{ marginTop: '.5rem' }}>
        Photographs {editing ? '' : '*'}
      </div>
      <div className="fr2">
        <FileUpload
          kind="pickPhoto"
          label="Photograph of vehicle at the gate"
          hint={editing ? 'keep existing or replace · max 5 MB each' : 'at least 1 · max 5 MB each'}
          accept="image/*"
          required={!gatePhotoIds.length}
          disabled={disabled}
          value={gatePhotoIds}
          onChange={setGatePhotoIds}
        />
        <FileUpload
          kind="processing"
          label="Material images inside the vehicle"
          hint={editing ? 'keep existing or replace · max 5 MB each' : 'at least 1 · max 5 MB each'}
          accept="image/*"
          required={!materialPhotoIds.length}
          disabled={disabled}
          value={materialPhotoIds}
          onChange={setMaterialPhotoIds}
        />
      </div>

      <div className="section-hd" style={{ marginTop: '.5rem' }}>
        Gate Signatures
      </div>
      <div className="fr3">
        <div className="fg">
          <label htmlFor="mr-drv">Driver Name</label>
          <input id="mr-drv" value={driverSign} onChange={(e) => setDriverSign(e.target.value)} required />
        </div>
        <div className="fg">
          <label htmlFor="mr-mgr">Factory Manager</label>
          <input id="mr-mgr" value={managerSign} onChange={(e) => setManagerSign(e.target.value)} required />
        </div>
        <div className="fg">
          <label htmlFor="mr-sec">Security Officer</label>
          <input
            id="mr-sec"
            value={securitySign}
            onChange={(e) => setSecuritySign(e.target.value)}
            required
            placeholder="Gate / name"
          />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="mr-note">Remarks</label>
        <input
          id="mr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="condition on arrival, discrepancies…"
        />
      </div>
      {error ? <p className="error">{error}</p> : null}
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          {editing ? 'Save MRN corrections' : 'Record goods receipt (MRN)'}
        </button>
      )}
    </form>
  );
}
