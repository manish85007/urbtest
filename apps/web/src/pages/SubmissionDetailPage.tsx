import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dataApi, filesApi, lifecycleApi, type SessionUser, type SubmissionDetail } from '../api';
import { StageBadge, StageProgress } from '../components/StageProgress';
import { InvoiceLifecyclePanel } from '../components/InvoiceLifecyclePanel';
import { FileUpload } from '../components/FileUpload';
import { useLookups } from '../hooks/useLookups';

export function SubmissionDetailPage({ user }: { user: SessionUser }) {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [invTab, setInvTab] = useState('');

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

  useEffect(() => {
    if (!sub?.invoices.length) return;
    if (!sub.invoices.some((i) => i.id === invTab)) {
      setInvTab(sub.invoices[0].id);
    }
  }, [sub, invTab]);

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
  const isClient = user.role === 'client';
  const stage = sub.derivedStage;
  const unweighed = sub.vehicles.filter((v) => !v.weighment);

  const activeInv = sub.invoices.find((i) => i.id === invTab) ?? sub.invoices[0];
  const netKg = sub.vehicles.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.7rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <div className="h1">{sub.id}</div>
            <StageBadge stage={stage} />
            {sub.rejectNote && stage === 1 ? <span className="badge bg-rd">Changes requested</span> : null}
          </div>
          <div className="p-mu" style={{ margin: '.15rem 0 0' }}>
            {sub.client.name} · {sub.site.name} · {sub.ref || 'no PO'} · raised {sub.requestDate.slice(0, 10)}
          </div>
        </div>
        <div className="spacer" />
        <Link to="/requests" className="btn bs">
          ← Back
        </Link>
        {isAdmin && stage === 1 ? (
          <button
            type="button"
            className="btn bp"
            disabled={busy}
            onClick={() => act(() => lifecycleApi.acknowledge(sub.id), 'Request acknowledged.')}
          >
            Acknowledge
          </button>
        ) : null}
        {isAdmin && stage === 3 ? (
          <button type="button" className="btn bp" onClick={() => document.getElementById('assign-vehicle')?.scrollIntoView()}>
            Assign Vehicle
          </button>
        ) : null}
      </div>

      <div className="card">
        <StageProgress current={stage} />
      </div>

      {msg ? <p className="ok-msg">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {sub.rejectNote && stage === 1 ? (
        <div className="card" style={{ background: 'var(--rd2)', borderColor: '#fecaca' }}>
          <div className="card-ttl" style={{ color: 'var(--rd)' }}>
            Changes requested by Urbeno
          </div>
          <div style={{ fontSize: '.87rem', marginTop: '.3rem' }}>{sub.rejectNote}</div>
        </div>
      ) : null}

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">📝 Request Details</div>
              <div className="spacer" />
              {isClient && stage === 1 && sub.rejectNote ? (
                <span className="badge bg-am">Update below</span>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '.45rem', marginBottom: '.6rem' }}>
              <div className="tile">
                <div className="tile-l">Approx Weight</div>
                <div className="tile-v">{sub.approxWeight} kg</div>
              </div>
              <div className="tile">
                <div className="tile-l">Approx Units</div>
                <div className="tile-v">{sub.approxQty}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Pickup Location</div>
                <div className="tile-v">{sub.location || '—'}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Raised By</div>
                <div className="tile-v">{sub.createdBy}</div>
              </div>
            </div>
            {sub.notes ? (
              <div className="tile" style={{ marginBottom: '.5rem' }}>
                <div className="tile-l">Notes</div>
                <div className="tile-v" style={{ fontWeight: 400 }}>
                  {sub.notes}
                </div>
              </div>
            ) : null}
            {isClient && stage === 1 && sub.rejectNote ? (
              <EditRequestForm
                sub={sub}
                disabled={busy}
                onSave={(body) =>
                  act(() => lifecycleApi.updateSubmission(sub.id, body), 'Request updated and sent back to Urbeno.')
                }
              />
            ) : null}
          </div>

          {isAdmin && stage === 1 ? (
            <div className="card">
              <div className="card-ttl">Acknowledge request</div>
              <p className="p-mu">Stage 2 — accept this pickup request and notify the client.</p>
              <RejectForm
                disabled={busy}
                onReject={(reason) =>
                  act(() => lifecycleApi.reject(sub.id, reason), 'Changes requested from client.')
                }
              />
            </div>
          ) : null}

          {isStaff && stage >= 3 && stage < 5 ? (
            <div className="card" id="assign-vehicle">
              <div className="card-hd">
                <div className="card-ttl">🚚 Vehicles</div>
                {netKg ? <span className="badge bg-g">{netKg} kg net</span> : null}
              </div>
              {sub.vehicles.length === 0 ? (
                <p className="dim">No vehicles assigned yet.</p>
              ) : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Registration</th>
                        <th>Driver</th>
                        <th>Net kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sub.vehicles.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <b>{v.registration}</b>
                          </td>
                          <td>
                            {v.driverName}
                            <div className="dim" style={{ fontSize: '.72rem' }}>
                              {v.driverPhone}
                            </div>
                          </td>
                          <td className="mono">
                            {v.weighment ? `${v.weighment.netKg}` : <span className="badge bg-am">Awaiting weighment</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {stage === 3 ? (
                <AssignVehicleForm
                  disabled={busy}
                  onAssign={(body) => act(() => lifecycleApi.addVehicle(sub.id, body), 'Vehicle assigned.')}
                />
              ) : null}
              {stage === 4 && unweighed.length > 0 ? (
                <WeighForm
                  vehicle={unweighed[0]}
                  disabled={busy}
                  onWeigh={(body) => act(() => lifecycleApi.weigh(unweighed[0].id, body), 'Weighment recorded.')}
                />
              ) : null}
            </div>
          ) : null}

          {isStaff && stage >= 5 && sub.invoices.length === 0 && sub.vehicles.every((v) => v.weighment) ? (
            <div className="card">
              <div className="card-ttl">🧾 Raise invoice</div>
              <p className="p-mu">All vehicles weighed — ready to bill.</p>
              <InvoiceForm
                vehicles={sub.vehicles}
                disabled={busy}
                onCreate={(body) => act(() => lifecycleApi.createInvoice(sub.id, body), 'Invoice created.')}
              />
            </div>
          ) : null}

          {sub.invoices.length > 0 ? (
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">Invoices &amp; lifecycle</div>
              </div>
              <div style={{ display: 'flex', gap: '.2rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
                {sub.invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className={`inv-tab ${inv.id === activeInv?.id ? 'on' : ''}`}
                    onClick={() => setInvTab(inv.id)}
                  >
                    {inv.invoiceNo}
                  </button>
                ))}
              </div>
              {activeInv ? (
                <InvoiceLifecyclePanel invoice={activeInv} user={user} disabled={busy} onAction={act} />
              ) : null}
            </div>
          ) : null}

          <CertificatesCard sub={sub} />
          <ComplianceCard sub={sub} isStaff={isStaff} />
        </div>

        <div>
          <div className="card">
            <div className="card-ttl">Details</div>
            <div style={{ display: 'grid', gap: '.4rem', marginTop: '.5rem' }}>
              <div className="tile">
                <div className="tile-l">Client</div>
                <div className="tile-v">
                  {sub.client.id} — {sub.client.name}
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">Site</div>
                <div className="tile-v">
                  {sub.site.code} — {sub.site.name}
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">Vehicles</div>
                <div className="tile-v">{sub.vehicles.length}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Invoices</div>
                <div className="tile-v">{sub.invoices.length}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Net weighed</div>
                <div className="tile-v">{netKg ? `${netKg} kg` : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CertificatesCard({ sub }: { sub: SubmissionDetail }) {
  const rows = sub.invoices.flatMap((inv) =>
    inv.certificates.map((c) => ({ inv, c })),
  );
  if (!rows.length && !sub.invoices.length) return null;
  if (!rows.length) return null;
  return (
    <div className="card" style={{ background: 'var(--g3)', borderColor: 'var(--g4)' }}>
      <div className="card-hd">
        <div className="card-ttl" style={{ color: 'var(--g2)' }}>
          🏅 Certificates of Destruction
        </div>
        <span className="badge bg-g">{rows.length}</span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Certificate</th>
              <th>Department</th>
              <th>Invoice</th>
              <th>Issued</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ inv, c }) => (
              <tr key={c.certNo}>
                <td className="mono">
                  <b>{c.certNo}</b>
                </td>
                <td>{c.department || <span className="dim">whole invoice</span>}</td>
                <td className="mono dim">{inv.invoiceNo}</td>
                <td className="dim">{c.certDate?.slice(0, 10) ?? '—'}</td>
                <td>
                  {c.fileId ? (
                    <a className="btn bp bsm" href={filesApi.url(c.fileId)} target="_blank" rel="noreferrer">
                      ⬇
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceCard({ sub, isStaff }: { sub: SubmissionDetail; isStaff: boolean }) {
  const docs: Array<{ kind: string; no: string; inv: string; dt: string; note: string; href?: string; internal?: boolean }> =
    [];
  for (const inv of sub.invoices) {
    if (inv.mrn && isStaff) {
      docs.push({
        kind: 'MRN',
        no: inv.mrn.mrnNo,
        inv: inv.invoiceNo,
        dt: inv.mrn.receivedAt?.slice(0, 10) ?? '',
        note: inv.mrn.factoryId,
        internal: true,
      });
    }
    if (inv.recycling) {
      docs.push({
        kind: 'Form 6',
        no: inv.recycling.form6No,
        inv: inv.invoiceNo,
        dt: inv.recycling.processedAt?.slice(0, 10) ?? '',
        note: `E-way ${inv.ewayBillNo || '—'}`,
      });
    }
    for (const c of inv.certificates) {
      docs.push({
        kind: 'Certificate',
        no: c.certNo,
        inv: inv.invoiceNo,
        dt: c.certDate?.slice(0, 10) ?? '',
        note: c.department || 'whole invoice',
        href: c.fileId ? filesApi.url(c.fileId) : undefined,
      });
    }
  }
  if (!docs.length) return null;
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">📁 Compliance Documents</div>
        <span className="badge bg-gy">{docs.length}</span>
      </div>
      <div className="dim" style={{ fontSize: '.78rem', marginBottom: '.5rem' }}>
        Every regulatory document raised against this request. Retained for a minimum of five years per Rule 12(4)
        of the E-Waste (Management) Rules, 2022; certificates for ten.
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Number</th>
              <th>Invoice</th>
              <th>Dated</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((dc) => (
              <tr key={`${dc.kind}-${dc.no}`}>
                <td>
                  <span className={`badge ${dc.kind === 'Certificate' ? 'bg-g' : dc.kind === 'Form 6' ? 'bg-bl' : 'bg-gy'}`}>
                    {dc.kind}
                  </span>
                  {dc.internal ? <div className="dim" style={{ fontSize: '.68rem' }}>internal</div> : null}
                </td>
                <td className="mono">
                  <b>{dc.no}</b>
                </td>
                <td className="mono dim">{dc.inv}</td>
                <td className="dim">{dc.dt || '—'}</td>
                <td className="dim" style={{ fontSize: '.78rem' }}>
                  {dc.note}
                </td>
                <td>
                  {dc.href ? (
                    <a className="btn bp bsm" href={dc.href} target="_blank" rel="noreferrer">
                      ⬇ Download
                    </a>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRequestForm({
  sub,
  disabled,
  onSave,
}: {
  sub: SubmissionDetail;
  disabled: boolean;
  onSave: (body: { location?: string; approxQty?: number; approxWeight?: number; notes?: string }) => void;
}) {
  const [location, setLocation] = useState(sub.location ?? '');
  const [approxQty, setApproxQty] = useState(String(sub.approxQty));
  const [approxWeight, setApproxWeight] = useState(String(sub.approxWeight));
  const [notes, setNotes] = useState(sub.notes ?? '');

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          location,
          approxQty: Number(approxQty),
          approxWeight: Number(approxWeight),
          notes,
        });
      }}
    >
      <label>
        Pickup location
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <div className="fr2">
        <label>
          Approx. quantity
          <input type="number" value={approxQty} onChange={(e) => setApproxQty(e.target.value)} />
        </label>
        <label>
          Approx. weight (kg)
          <input type="number" step="0.001" value={approxWeight} onChange={(e) => setApproxWeight(e.target.value)} />
        </label>
      </div>
      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>
      <button type="submit" className="btn primary" disabled={disabled}>
        Save and resubmit
      </button>
    </form>
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
  const vehicleTypes = useLookups('vehicleType');
  const teamRoles = useLookups('teamRole');
  const [registration, setRegistration] = useState('');
  const [vehicleType, setVehicleType] = useState('VT2');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onAssign({
          registration,
          vehicleType,
          driverName,
          driverPhone,
          team: [{ name: driverName, role: teamRoles[0]?.id ?? 'TR1', phone: driverPhone }],
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
          Vehicle type
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {vehicleTypes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fr2">
        <label>
          Driver name
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
        </label>
        <label>
          Driver phone
          <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required />
        </label>
      </div>
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
