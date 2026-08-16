import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { stageLabel } from '@urb-tectrack/shared';
import { dataApi, lifecycleApi, type SessionUser, type SubmissionDetail } from '../api';
import { StageBadge, StageProgress } from '../components/StageProgress';

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
        <Link to="/">← Dashboard</Link>
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

      {isStaff && stage >= 5 ? (
        <section className="card">
          <h2>Invoices</h2>
          {sub.invoices.length === 0 ? (
            <>
              <p className="muted">All vehicles weighed — ready to raise an invoice.</p>
              {sub.vehicles.every((v) => v.weighment) ? (
                <InvoiceForm
                  vehicles={sub.vehicles}
                  disabled={busy}
                  onCreate={(body) =>
                    act(
                      () => lifecycleApi.createInvoice(sub.id, body),
                      'Invoice created.',
                    )
                  }
                />
              ) : null}
            </>
          ) : (
            <ul className="list">
              {sub.invoices.map((inv) => (
                <li key={inv.id}>
                  <strong>{inv.invoiceNo}</strong> — {inv.billingWeight} kg —{' '}
                  {stageLabel(inv.derivedStage)}
                  {inv.payments.length === 0 ? (
                    <span className="badge warn"> Unpaid</span>
                  ) : (
                    <span className="badge"> Payment recorded</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="card">
        <h2>Lifecycle reference</h2>
        <p className="muted">
          Current stage: <strong>{stageLabel(stage)}</strong>. Factory stages (MRN, recycling) and
          certificate upload are available via API — UI for stages 6–9 follows in the next milestone.
        </p>
      </section>
    </div>
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
  const today = new Date().toISOString().slice(0, 10);
  const placeholderPhoto = ['demo-slip-photo'];
  const placeholderPickup = ['demo-pickup-photo'];

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
          slipPhotoIds: placeholderPhoto,
          pickupPhotoIds: placeholderPickup,
        });
      }}
    >
      <h3>Weigh {vehicle.registration}</h3>
      <p className="hint">Photos use placeholder IDs until file upload (Phase 4) is wired.</p>
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
      <button type="submit" className="btn primary" disabled={disabled}>
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
