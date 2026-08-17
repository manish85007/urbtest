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

export function MrnForm({
  formId,
  invoice,
  vehicles,
  lineItems,
  userName,
  disabled,
  onSubmit,
}: MrnFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const invoiceVehs = vehicles.filter(
    (v) => !invoice.vehicleIds?.length || invoice.vehicleIds.includes(v.id),
  );
  const [factories, setFactories] = useState<Array<{ id: string; name: string }>>([]);
  const [factoryId, setFactoryId] = useState(invoice.mrn?.factoryId ?? 'URB-BLR');
  const [receivedAt, setReceivedAt] = useState(today);
  const [condition, setCondition] = useState('Good');
  const [note, setNote] = useState('');
  const [driverSign, setDriverSign] = useState(invoiceVehs[0]?.driverName ?? '');
  const [managerSign, setManagerSign] = useState(userName);
  const [securitySign, setSecuritySign] = useState('');
  const [gatePhotoIds, setGatePhotoIds] = useState<string[]>([]);
  const [materialPhotoIds, setMaterialPhotoIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [mats, setMats] = useState<MatRow[]>(() =>
    lineItems.length
      ? lineItems.map((it) => ({
          name: it.name,
          qty: String(it.qty || ''),
          weight: String(it.weightKg || ''),
        }))
      : [{ name: '', qty: '', weight: '' }],
  );

  useEffect(() => {
    dataApi.factories().then((list) => {
      setFactories(list);
      if (list[0] && !list.some((f) => f.id === factoryId)) setFactoryId(list[0].id);
    });
  }, [factoryId]);

  const preview = useMemo(() => {
    const fy = getFY(receivedAt);
    return fy ? formatMrnNumber(factoryId, fy.short, 0).replace(/0000$/, '[next]') : '—';
  }, [factoryId, receivedAt]);

  const netTotal = invoiceVehs.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);

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
        The MRN records what physically arrived at the gate — vehicle, weighment and quantity. Material is
        classified into authorised categories later, at recycling.
      </p>
      <div style={{ background: 'var(--g3)', padding: '.5rem .8rem', borderRadius: 8, fontSize: '.83rem', marginBottom: '.8rem' }}>
        MRN number: <b className="mono">{preview}</b>
        <div className="dim" style={{ fontSize: '.73rem', marginTop: '.15rem' }}>
          Format MRN/[Factory]/[FY]/[Sequence] — resets each April
        </div>
      </div>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="mr-fac">Factory Site</label>
          <select id="mr-fac" value={factoryId} onChange={(e) => setFactoryId(e.target.value)} required>
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
          as counted at the gate — categories are assigned later
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
            step="0.1"
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
        Photographs *
      </div>
      <div className="fr2">
        <FileUpload
          kind="pickPhoto"
          label="Photograph of vehicle at the gate"
          hint="at least 1 · max 5 MB each"
          accept="image/*"
          required
          disabled={disabled}
          value={gatePhotoIds}
          onChange={setGatePhotoIds}
        />
        <FileUpload
          kind="processing"
          label="Material images inside the vehicle"
          hint="at least 1 · max 5 MB each"
          accept="image/*"
          required
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
          Record goods receipt (MRN)
        </button>
      )}
    </form>
  );
}
