import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dataApi, lifecycleApi, type SessionUser, type SubmissionDetail } from '../api';
import { StageBadge, StageProgress } from '../components/StageProgress';
import { InvoiceLifecyclePanel } from '../components/InvoiceLifecyclePanel';
import { FileUpload } from '../components/FileUpload';

export function SubmissionDetailPage({ user }: { user: SessionUser }) {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    dataApi
      .submission(id)
      .then(setSub)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
      setMsg(success);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!sub) {
    return (
      <div>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading request…</p>}
      </div>
    );
  }

  const isStaff = user.role === 'admin' || user.role === 'factory';
  const isAdmin = user.role === 'admin';
  const stage = sub.derivedStage;
  const unweighed = sub.vehicles.filter((v) => !v.weighment);

  return (
    <div>
      <p className="muted">
        <Link to="/requests">← Requests</Link>
      </p>
      <div className="f-row">
        <h1 className="h1">{sub.id}</h1>
        <StageBadge stage={stage} />
      </div>
      <p className="muted">
        {sub.client.name} · {sub.site.name} · {sub.requestDate.slice(0, 10)}
      </p>

      <StageProgress current={stage} />

      {msg ? <p className="ok-msg">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Approx. weight</div>
          <div className="stat-value sm">{sub.approxWeight} kg</div>
        </div>
        <div className="stat">
          <div className="stat-label">Vehicles</div>
          <div className="stat-value sm">{sub.vehicles.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Invoices</div>
          <div className="stat-value sm">{sub.invoices.length}</div>
        </div>
      </div>

      {sub.notes ? (
        <section className="card">
          <h2>Notes</h2>
          <p>{sub.notes}</p>
        </section>
      ) : null}

      {/* Stage actions */}
      {isAdmin && stage === 1 ? (
        <section className="card">
          <h2>Acknowledge request</h2>
          <p className="muted">Stage 2 — accept this pickup request and notify the client.</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => act(() => lifecycleApi.acknowledge(sub.id), 'Request acknowledged.')}
            >
              Acknowledge
            </button>
          </div>
          <RejectForm
            disabled={busy}
            onReject={(reason) =>
              act(() => lifecycleApi.reject(sub.id, reason), 'Changes requested from client.')
            }
          />
        </section>
      ) : null}

      {isStaff && stage >= 3 && stage < 5 ? (
        <section className="card">
          <h2>Vehicles</h2>
          {sub.vehicles.length === 0 ? (
            <p className="muted">No vehicles assigned yet.</p>
          ) : (
            <ul className="list">
              {sub.vehicles.map((v) => (
                <li key={v.id}>
                  <strong>{v.registration}</strong> — {v.driverName}
                  {v.weighment ? (
                    <span className="badge"> {v.weighment.netKg} kg net</span>
                  ) : (
                    <span className="badge warn"> Awaiting weighment</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {stage === 3 ? (
            <AssignVehicleForm
              disabled={busy}
              onAssign={(body) =>
                act(
                  () => lifecycleApi.addVehicle(sub.id, body),
                  'Vehicle assigned.',
                )
              }
            />
          ) : null}
          {stage === 4 && unweighed.length > 0 ? (
            <WeighForm
              vehicle={unweighed[0]}
              disabled={busy}
              onWeigh={(body) =>
                act(
                  () => lifecycleApi.weigh(unweighed[0].id, body),
                  'Weighment recorded.',
                )
              }
            />
          ) : null}
        </section>
      ) : null}

      {sub.invoices.length > 0 ? (
        <section className="card">
          <h2>Invoices &amp; lifecycle</h2>
          {sub.invoices.map((inv) => (
            <InvoiceLifecyclePanel
              key={inv.id}
              invoice={inv}
              user={user}
              disabled={busy}
              onAction={act}
            />
          ))}
        </section>
      ) : null}

      {isStaff && stage >= 5 && sub.invoices.length === 0 ? (
        <section className="card">
          <h2>Raise invoice</h2>
          <p className="muted">All vehicles weighed — ready to bill.</p>
          {sub.vehicles.every((v) => v.weighment) ? (
            <InvoiceForm
              vehicles={sub.vehicles}
              disabled={busy}
              onCreate={(body) =>
                act(() => lifecycleApi.createInvoice(sub.id, body), 'Invoice created.')
              }
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function RejectForm({
  disabled,
  onReject,
}: {
  disabled: boolean;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn ghost" disabled={disabled} onClick={() => setOpen(true)}>
        Request changes
      </button>
    );
  }

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onReject(reason);
        setOpen(false);
        setReason('');
      }}
    >
      <h3>Request changes</h3>
      <label>
        Note to client
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="btn secondary" disabled={disabled || !reason.trim()}>
          Send back to client
        </button>
      </div>
    </form>
  );
}

function AssignVehicleForm({
  disabled,
  onAssign,
}: {
  disabled: boolean;
  onAssign: (body: {
    registration: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    team: Array<{ name: string; role: string; phone: string }>;
  }) => void;
}) {
  const [registration, setRegistration] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onAssign({
          registration,
          vehicleType: 'VT2',
          driverName,
          driverPhone,
          team: [{ name: driverName, role: 'TR1', phone: driverPhone }],
        });
      }}
    >
      <h3>Assign vehicle</h3>
      <div className="fr2">
        <label>
          Registration
          <input value={registration} onChange={(e) => setRegistration(e.target.value)} required />
        </label>
        <label>
          Driver name
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
        </label>
      </div>
      <label>
        Driver phone
        <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required />
      </label>
      <button type="submit" className="btn primary" disabled={disabled}>
        Assign vehicle
      </button>
    </form>
  );
}

function WeighForm({
  vehicle,
  disabled,
  onWeigh,
}: {
  vehicle: { registration: string };
  disabled: boolean;
  onWeigh: (body: {
    weighedAt: string;
    gross: number;
    tare: number;
    slipNumber: string;
    slipPhotoIds: string[];
    pickupPhotoIds: string[];
  }) => void;
}) {
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [slip, setSlip] = useState('');
  const [slipPhotos, setSlipPhotos] = useState<string[]>([]);
  const [pickupPhotos, setPickupPhotos] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onWeigh({
          weighedAt: today,
          gross: Number(gross),
          tare: Number(tare),
          slipNumber: slip,
          slipPhotoIds: slipPhotos,
          pickupPhotoIds: pickupPhotos,
        });
      }}
    >
      <h3>Weigh {vehicle.registration}</h3>
      <FileUpload
        kind="weighPhoto"
        label="Weighment slip photos"
        hint="At least 1 photo · max 5 MB each · JPG/PNG"
        accept="image/jpeg,image/png,image/webp"
        required
        disabled={disabled}
        value={slipPhotos}
        onChange={setSlipPhotos}
      />
      <FileUpload
        kind="pickPhoto"
        label="Pickup photos"
        hint="At least 1 photo · max 5 MB each · JPG/PNG"
        accept="image/jpeg,image/png,image/webp"
        required
        disabled={disabled}
        value={pickupPhotos}
        onChange={setPickupPhotos}
      />
      <div className="fr3">
        <label>
          Gross (kg)
          <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} required />
        </label>
        <label>
          Tare (kg)
          <input type="number" step="0.001" value={tare} onChange={(e) => setTare(e.target.value)} required />
        </label>
        <label>
          Slip no.
          <input value={slip} onChange={(e) => setSlip(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn primary" disabled={disabled || !slipPhotos.length || !pickupPhotos.length}>
        Record weighment
      </button>
    </form>
  );
}

function InvoiceForm({
  vehicles,
  disabled,
  onCreate,
}: {
  vehicles: Array<{ id: string; registration: string; weighment: { netKg: string } | null }>;
  disabled: boolean;
  onCreate: (body: {
    invoiceNo: string;
    invoiceDate: string;
    taxableAmount: number;
    ewayBillNo: string;
    ewayBillDate: string;
    vehicleIds: string[];
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [taxableAmount, setTaxableAmount] = useState('10000');
  const [eway, setEway] = useState('EWB-DEMO-001');

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({
          invoiceNo,
          invoiceDate: today,
          taxableAmount: Number(taxableAmount),
          ewayBillNo: eway,
          ewayBillDate: today,
          vehicleIds: vehicles.map((v) => v.id),
        });
      }}
    >
      <h3>Raise invoice</h3>
      <div className="fr2">
        <label>
          Invoice no.
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} required />
        </label>
        <label>
          Taxable amount (₹)
          <input type="number" min="0" value={taxableAmount} onChange={(e) => setTaxableAmount(e.target.value)} required />
        </label>
      </div>
      <label>
        E-way bill no.
        <input value={eway} onChange={(e) => setEway(e.target.value)} required />
      </label>
      <button type="submit" className="btn primary" disabled={disabled}>
        Create invoice
      </button>
    </form>
  );
}
