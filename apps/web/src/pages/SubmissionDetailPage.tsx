import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPayStatus } from '@urb-tectrack/shared';
import { dataApi, filesApi, lifecycleApi, type SessionUser, type SubmissionDetail, type VehicleDetail } from '../api';
import { StageBadge, StageProgress } from '../components/StageProgress';
import { InvoiceLifecyclePanel } from '../components/InvoiceLifecyclePanel';
import { FileUpload } from '../components/FileUpload';
import { FileRow, FileThumb } from '../components/FileThumb';
import { QueryThread } from '../components/QueryThread';
import { lookupLabel, useLookups } from '../hooks/useLookups';
import { fmtDate, fmtTS, num } from '../lib/format';

export function SubmissionDetailPage({ user }: { user: SessionUser }) {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [invTab, setInvTab] = useState('');
  const [addInvoice, setAddInvoice] = useState(false);

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
  const stage = sub.derivedStage;
  const unweighed = sub.vehicles.filter((v) => !v.weighment);
  const activeInv = sub.invoices.find((i) => i.id === invTab) ?? sub.invoices[0];
  const netKg = sub.vehicles.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);
  const allWeighed = sub.vehicles.length > 0 && sub.vehicles.every((v) => v.weighment);
  const showInvoiceForm =
    isStaff && stage >= 5 && allWeighed && (sub.invoices.length === 0 || addInvoice);

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.7rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <h1 className="h1">{sub.id}</h1>
            <StageBadge stage={stage} />
            {sub.rejectNote && stage === 1 ? <span className="badge bg-rd">Changes requested</span> : null}
          </div>
          <div className="p-mu" style={{ margin: '.15rem 0 0' }}>
            {sub.client.name} · {sub.site.name} · {sub.ref || 'no PO'} · raised {fmtDate(sub.requestDate)}
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
            ✅ Acknowledge Request
          </button>
        ) : null}
        {isAdmin && stage === 3 ? (
          <button type="button" className="btn bp" onClick={() => document.getElementById('assign-vehicle')?.scrollIntoView()}>
            🚚 Assign Vehicle
          </button>
        ) : null}
        {isAdmin && stage === 4 ? (
          unweighed.length ? (
            <button type="button" className="btn bp" onClick={() => document.getElementById('weigh-form')?.scrollIntoView()}>
              ⚖️ Weigh ({unweighed.length} pending)
            </button>
          ) : (
            <button type="button" className="btn bp" onClick={() => document.getElementById('raise-invoice')?.scrollIntoView()}>
              🧾 Raise Invoice
            </button>
          )
        ) : null}
        {isAdmin && stage === 5 ? (
          <button
            type="button"
            className="btn bp"
            onClick={() => {
              setAddInvoice(true);
              document.getElementById('raise-invoice')?.scrollIntoView();
            }}
          >
            🧾 Add Invoice
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
          {sub.rejectAt ? (
            <div className="dim" style={{ fontSize: '.73rem', marginTop: '.3rem' }}>
              {fmtTS(sub.rejectAt)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="detail-grid">
        <div>
          <RequestCard
            sub={sub}
            user={user}
            busy={busy}
            onSave={(body) =>
              act(() => lifecycleApi.updateSubmission(sub.id, body), 'Request updated and sent back to Urbeno.')
            }
            onBom={(bomFileId) =>
              act(() => lifecycleApi.updateSubmission(sub.id, { bomFileId }), 'Bill of materials updated.')
            }
          />

          {isAdmin && stage === 1 ? (
            <div className="card">
              <div className="card-ttl">Acknowledge request</div>
              <p className="p-mu">
                Accepting this request moves it to Assign Vehicle and notifies the requestor. Use the
                header action to accept, or request changes below.
              </p>
              <RejectForm
                disabled={busy}
                onReject={(reason) =>
                  act(() => lifecycleApi.reject(sub.id, reason), 'Changes requested from client.')
                }
              />
            </div>
          ) : null}

          <VehicleCard
            sub={sub}
            user={user}
            busy={busy}
            netKg={netKg}
            unweighed={unweighed}
            onAssign={(body) => act(() => lifecycleApi.addVehicle(sub.id, body), 'Vehicle assigned.')}
            onWeigh={(vehicleId, body) => act(() => lifecycleApi.weigh(vehicleId, body), 'Weighment recorded.')}
          />

          {showInvoiceForm ? (
            <div className="card" id="raise-invoice">
              <div className="card-ttl">🧾 Raise invoice</div>
              <p className="p-mu">All vehicles weighed — ready to bill.</p>
              <InvoiceForm
                vehicles={sub.vehicles}
                disabled={busy}
                onCreate={(body) => {
                  setAddInvoice(false);
                  return act(() => lifecycleApi.createInvoice(sub.id, body), 'Invoice created.');
                }}
              />
            </div>
          ) : null}

          {sub.invoices.length > 0 ? (
            <div className="card" style={{ padding: '.5rem' }}>
              <div style={{ display: 'flex', gap: '.2rem', flexWrap: 'wrap', padding: '0 .2rem', borderBottom: '1px solid var(--bd)' }}>
                {sub.invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className={`inv-tab ${inv.id === activeInv?.id ? 'on' : ''}`}
                    onClick={() => setInvTab(inv.id)}
                  >
                    {inv.invoiceNo}{' '}
                    <span
                      className={`badge ${inv.derivedStage >= 9 ? 'bg-g' : inv.derivedStage >= 6 ? 'bg-bl' : 'bg-am'}`}
                      style={{ marginLeft: '.2rem' }}
                    >
                      {inv.derivedStage}
                    </span>
                  </button>
                ))}
                {isAdmin ? (
                  <button
                    type="button"
                    className="inv-tab"
                    style={{ color: 'var(--g)', fontWeight: 700 }}
                    onClick={() => {
                      setAddInvoice(true);
                      document.getElementById('raise-invoice')?.scrollIntoView();
                    }}
                  >
                    + Invoice
                  </button>
                ) : null}
              </div>
              {activeInv ? (
                <InvoiceLifecyclePanel
                  invoice={activeInv}
                  vehicles={sub.vehicles}
                  payTermsDays={sub.client.payTermsDays ?? 30}
                  user={user}
                  disabled={busy}
                  onAction={act}
                />
              ) : null}
            </div>
          ) : null}

          <CertificatesCard sub={sub} user={user} />
          <ComplianceCard sub={sub} isStaff={isStaff} />
        </div>

        <div>
          <DetailsCard sub={sub} />
          <QueryThread
            submissionId={sub.id}
            queries={sub.queries ?? []}
            user={user}
            disabled={busy}
            onAction={act}
          />
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  sub,
  user,
  busy,
  onSave,
  onBom,
}: {
  sub: SubmissionDetail;
  user: SessionUser;
  busy: boolean;
  onSave: (body: { location?: string; approxQty?: number; approxWeight?: number; notes?: string; ref?: string }) => void;
  onBom: (bomFileId: string | null) => void;
}) {
  const isClient = user.role === 'client';
  const isAdmin = user.role === 'admin';
  const canEdit = sub.derivedStage === 1 && (isAdmin || (isClient && !!sub.rejectNote));
  const showResubmit = isClient && sub.derivedStage === 1 && !!sub.rejectNote;
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">📝 Request Details</div>
        <div className="spacer" />
        {showResubmit ? <span className="badge bg-am">Update below</span> : null}
        {canEdit && !showResubmit ? (
          <button type="button" className="btn bs bsm" onClick={() => setEditing((v) => !v)}>
            ✏️ Edit
          </button>
        ) : null}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
          gap: '.45rem',
          marginBottom: '.6rem',
        }}
      >
        <div className="tile">
          <div className="tile-l">Approx Weight</div>
          <div className="tile-v">{num(Number(sub.approxWeight))} kg</div>
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
      <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.3rem' }}>
        Bill of Materials
      </div>
      {sub.bomFileId ? (
        <div className="frow">
          <FileThumb id={sub.bomFileId} kind="doc" name="BoM" />
          {canEdit ? (
            <button type="button" className="btn brd bsm" disabled={busy} onClick={() => onBom(null)}>
              ×
            </button>
          ) : null}
        </div>
      ) : (
        <div className="dim" style={{ fontSize: '.8rem', marginBottom: '.4rem' }}>
          No BoM file attached{canEdit ? ' — upload a CSV, Excel or PDF listing line items' : ''}
        </div>
      )}
      {canEdit && !sub.bomFileId ? (
        <FileUpload
          kind="bom"
          label="Upload BoM"
          hint="CSV, Excel or PDF listing line items"
          accept=".csv,.xls,.xlsx,application/pdf,text/csv"
          disabled={busy}
          value={[]}
          onChange={(ids) => {
            if (ids[0]) onBom(ids[0]);
          }}
        />
      ) : null}
      {showResubmit || editing ? (
        <EditRequestForm sub={sub} disabled={busy} resubmit={showResubmit} onSave={onSave} />
      ) : null}
    </div>
  );
}

function VehicleCard({
  sub,
  user,
  busy,
  netKg,
  unweighed,
  onAssign,
  onWeigh,
}: {
  sub: SubmissionDetail;
  user: SessionUser;
  busy: boolean;
  netKg: number;
  unweighed: VehicleDetail[];
  onAssign: (body: {
    registration: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    logisticsPartner?: string;
    expectedAt?: string;
    team: Array<{ name: string; role: string; phone: string }>;
  }) => void;
  onWeigh: (
    vehicleId: string,
    body: {
      weighedAt: string;
      manual?: boolean;
      gross?: number;
      tare?: number;
      net?: number;
      slipNumber?: string;
      reason?: string;
      slipPhotoIds: string[];
      pickupPhotoIds: string[];
    },
  ) => void;
}) {
  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const stage = sub.derivedStage;
  const vehicleTypes = useLookups('vehicleType');
  const logistics = useLookups('logistics');
  const teamRoles = useLookups('teamRole');
  const [addOpen, setAddOpen] = useState(false);

  if (!sub.vehicles.length && stage < 3) return null;

  const canAdd = isAdmin && stage >= 3 && stage <= 5;
  const showAssign = isStaff && (stage === 3 || (canAdd && addOpen));
  const weighTarget = unweighed[0];

  return (
    <div className="card" id="assign-vehicle">
      <div className="card-hd">
        <div className="card-ttl">🚚 Vehicles & Weighment ({sub.vehicles.length})</div>
        <div className="spacer" />
        {netKg ? <span className="badge bg-g">{num(netKg)} kg net</span> : null}
        {canAdd && stage !== 3 ? (
          <button type="button" className="btn bs bsm" onClick={() => setAddOpen((v) => !v)}>
            + Add Vehicle
          </button>
        ) : null}
      </div>
      {!sub.vehicles.length ? (
        <div className="dim" style={{ fontSize: '.83rem' }}>
          No vehicles assigned yet
        </div>
      ) : (
        sub.vehicles.map((v) => {
          const w = v.weighment;
          return (
            <div className="sub-card" key={v.id}>
              <div className="sub-card-hd">
                <b className="mono">{v.registration}</b>
                <span className="badge bg-gy">{lookupLabel(vehicleTypes, v.vehicleType)}</span>
                <span className={`badge ${w ? 'bg-g' : 'bg-am'}`}>
                  {w ? `⚖️ ${num(Number(w.netKg))} kg` : 'Awaiting weighment'}
                </span>
                {w?.manual ? (
                  <span className="badge bg-am" title="Recorded without a weighbridge">
                    ✍️ Manual
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(115px,1fr))',
                  gap: '.4rem',
                  marginBottom: '.4rem',
                }}
              >
                <div className="tile">
                  <div className="tile-l">Driver</div>
                  <div className="tile-v">{v.driverName}</div>
                  <div className="dim mono" style={{ fontSize: '.7rem' }}>
                    {v.driverPhone}
                  </div>
                </div>
                <div className="tile">
                  <div className="tile-l">Partner</div>
                  <div className="tile-v">{lookupLabel(logistics, v.logisticsPartner)}</div>
                </div>
                <div className="tile">
                  <div className="tile-l">Expected</div>
                  <div className="tile-v">{v.expectedAt ? fmtTS(v.expectedAt) : '—'}</div>
                </div>
                {w && !w.manual ? (
                  <>
                    <div className="tile">
                      <div className="tile-l">Gross / Tare</div>
                      <div className="tile-v mono">
                        {num(Number(w.grossKg ?? 0))} / {num(Number(w.tareKg ?? 0))}
                      </div>
                    </div>
                    <div className="tile">
                      <div className="tile-l">Slip #</div>
                      <div className="tile-v mono">{w.slipNumber || '—'}</div>
                    </div>
                    <div className="tile">
                      <div className="tile-l">Loaded</div>
                      <div className="tile-v">{fmtDate(w.weighedAt)}</div>
                    </div>
                  </>
                ) : null}
                {w?.manual ? (
                  <>
                    <div className="tile">
                      <div className="tile-l">Method</div>
                      <div className="tile-v">{w.method || 'Manual'}</div>
                    </div>
                    <div className="tile">
                      <div className="tile-l">Loaded</div>
                      <div className="tile-v">{fmtDate(w.weighedAt)}</div>
                    </div>
                  </>
                ) : null}
              </div>
              {v.team?.length ? (
                <>
                  <div style={{ fontSize: '.73rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
                    Team ({v.team.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem', marginBottom: '.4rem' }}>
                    {v.team.map((t, i) => (
                      <span key={`${t.phone}-${i}`} className="badge bg-bl">
                        {t.name} · {lookupLabel(teamRoles, t.role)} · {t.phone}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {w?.manual && w.reason ? (
                <div
                  style={{
                    background: 'var(--am2)',
                    border: '1px solid #fcd34d',
                    borderRadius: 8,
                    padding: '.4rem .65rem',
                    fontSize: '.78rem',
                    color: 'var(--g2)',
                    marginBottom: '.4rem',
                  }}
                >
                  <b style={{ color: 'var(--am)' }}>No weighbridge used:</b> {w.reason}
                </div>
              ) : null}
              {w ? (
                <div style={{ display: 'grid', gridTemplateColumns: w.manual ? '1fr' : '1fr 1fr', gap: '.5rem' }}>
                  {w.manual ? null : (
                    <div>
                      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
                        Weighment slips ({w.slipPhotoIds?.length ?? 0})
                      </div>
                      <FileRow ids={w.slipPhotoIds} kind="image" />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
                      Pickup photos ({w.pickupPhotoIds?.length ?? 0})
                    </div>
                    <FileRow ids={w.pickupPhotoIds} kind="image" />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
      {sub.vehicles.length ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '.45rem .6rem',
            background: 'var(--g3)',
            borderRadius: 7,
            fontSize: '.85rem',
            fontWeight: 700,
            color: 'var(--g2)',
            marginTop: '.3rem',
          }}
        >
          <span>Total net weighed</span>
          <span className="mono">{num(netKg)} kg</span>
        </div>
      ) : null}
      {showAssign ? <AssignVehicleForm disabled={busy} onAssign={onAssign} /> : null}
      {isStaff && stage === 4 && weighTarget ? (
        <div id="weigh-form">
          <WeighForm
            vehicle={weighTarget}
            disabled={busy}
            onWeigh={(body) => onWeigh(weighTarget.id, body)}
          />
        </div>
      ) : null}
    </div>
  );
}

function DetailsCard({ sub }: { sub: SubmissionDetail }) {
  return (
    <div className="card">
      <div className="card-ttl" style={{ marginBottom: '.5rem' }}>
        Details
      </div>
      <div className="tile" style={{ marginBottom: '.4rem' }}>
        <div className="tile-l">Client</div>
        <div className="tile-v">
          {sub.client.name} <span className="badge bg-gy">{sub.client.id}</span>
        </div>
      </div>
      <div className="tile" style={{ marginBottom: '.4rem' }}>
        <div className="tile-l">Site</div>
        <div className="tile-v">{sub.site.name}</div>
        <div className="dim" style={{ fontSize: '.72rem' }}>
          {sub.site.address || sub.site.code}
        </div>
      </div>
      <div className="tile" style={{ marginBottom: '.4rem' }}>
        <div className="tile-l">Site GST</div>
        <div className="tile-v mono">{sub.site.gstin || '—'}</div>
      </div>
      <div className="tile" style={{ marginBottom: '.4rem' }}>
        <div className="tile-l">Site Contact</div>
        <div className="tile-v">{sub.site.contactName || '—'}</div>
        <div className="dim mono" style={{ fontSize: '.72rem' }}>
          {sub.site.contactPhone || ''}
        </div>
      </div>
      <div className="tile" style={{ marginBottom: '.4rem' }}>
        <div className="tile-l">Raised</div>
        <div className="tile-v">{fmtTS(sub.createdAt || sub.requestDate)}</div>
      </div>
      {sub.acknowledgedAt ? (
        <div className="tile">
          <div className="tile-l">Acknowledged</div>
          <div className="tile-v">{fmtTS(sub.acknowledgedAt)}</div>
          {sub.acknowledgedBy ? (
            <div className="dim" style={{ fontSize: '.72rem' }}>
              by {sub.acknowledgedBy}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CertificatesCard({ sub, user }: { sub: SubmissionDetail; user: SessionUser }) {
  const rows = sub.invoices.flatMap((inv) => inv.certificates.map((c) => ({ inv, c })));
  const isAdmin = user.role === 'admin';
  const eligible = sub.invoices.filter((i) => i.derivedStage >= 7);
  const canUp = isAdmin && sub.invoices.some((i) => i.derivedStage >= 7 && !i.closedAt);
  if (!sub.invoices.length) return null;
  if (!rows.length && !canUp && !eligible.length) return null;

  return (
    <div className="card" style={rows.length ? { background: 'var(--g3)', borderColor: 'var(--g4)' } : undefined}>
      <div className="card-hd">
        <div className="card-ttl" style={{ color: 'var(--g2)' }}>
          🏅 Certificates of Destruction
        </div>
        {rows.length ? <span className="badge bg-g">{rows.length}</span> : <span className="badge bg-am">None yet</span>}
        <div className="spacer" />
        {canUp ? (
          <button
            type="button"
            className={`btn ${rows.length ? 'bs' : 'bp'} bsm`}
            onClick={() => document.querySelector('.inv-panel')?.scrollIntoView()}
          >
            + Upload Certificate
          </button>
        ) : null}
      </div>
      {!rows.length ? (
        <div className="dim" style={{ fontSize: '.83rem' }}>
          Certificates are prepared outside the system and uploaded here. Upload as many as the client
          needs — one per invoice, or several against a single invoice when the material belongs to
          different teams. Each upload emails the client automatically.
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Certificate</th>
                <th>Department / Scope</th>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Emailed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ inv, c }) => (
                <tr key={c.id ?? c.certNo}>
                  <td className="mono">
                    <b>{c.certNo}</b>
                    {c.note ? <div className="dim" style={{ fontSize: '.7rem' }}>{c.note}</div> : null}
                  </td>
                  <td>{c.department || <span className="dim">whole invoice</span>}</td>
                  <td className="mono dim">{inv.invoiceNo}</td>
                  <td className="dim">{fmtDate(c.certDate)}</td>
                  <td>
                    {c.mailedAt ? <span className="badge bg-g">✉️ sent</span> : <span className="dim">—</span>}
                  </td>
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
      )}
      {eligible.length ? (
        <div style={{ marginTop: '.6rem', borderTop: '1px solid var(--g4)', paddingTop: '.55rem' }}>
          <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.35rem' }}>
            Closure — one acknowledgement per invoice
          </div>
          {eligible.map((inv) => {
            const paid = inv.payments.reduce((s, p) => {
              try {
                return s + BigInt(p.amountPaise);
              } catch {
                return s;
              }
            }, 0n);
            const pay = getPayStatus(BigInt(inv.totalPaise), paid);
            if (inv.closedAt) {
              return (
                <div className="sub-card" style={{ background: '#fff' }} key={inv.id}>
                  <div className="sub-card-hd">
                    <b className="mono" style={{ fontSize: '.82rem' }}>
                      {inv.invoiceNo}
                    </b>
                    <span className="badge bg-g">🎉 Closed</span>
                    <div className="spacer" />
                    <span className="dim" style={{ fontSize: '.73rem' }}>
                      {fmtTS(inv.closedAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--g2)' }}>
                    Acknowledged by {inv.closedBy || 'the requestor'}
                    {inv.forceClosed ? ' (admin force-close)' : ''}
                    {inv.closeRating ? ` · rated ${inv.closeRating}/5` : ''}
                  </div>
                  {inv.closeNote ? (
                    <div style={{ fontSize: '.8rem', marginTop: '.2rem' }}>&ldquo;{inv.closeNote}&rdquo;</div>
                  ) : null}
                </div>
              );
            }
            const noCod = !inv.certificates.length;
            return (
              <div className="sub-card" style={{ background: '#fff' }} key={inv.id}>
                <div className="sub-card-hd">
                  <b className="mono" style={{ fontSize: '.82rem' }}>
                    {inv.invoiceNo}
                  </b>
                  <span className={`badge ${pay.key === 'paid' ? 'bg-g' : pay.key === 'partial' ? 'bg-am' : 'bg-rd'}`}>
                    {pay.label}
                  </span>
                  {noCod ? <span className="badge bg-am">awaiting certificate</span> : null}
                </div>
                <div className="dim" style={{ fontSize: '.78rem' }}>
                  {noCod
                    ? 'A certificate has to be uploaded before this invoice can be closed.'
                    : pay.key !== 'paid'
                      ? 'Payment is still outstanding — the invoice must be settled before closure.'
                      : 'Ready for the requestor to review the certificate and acknowledge closure.'}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
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
        dt: inv.mrn.receivedAt ?? '',
        note: inv.mrn.factory?.name || inv.mrn.factoryId,
        href: filesApi.pdf(`/invoices/${inv.id}/mrn.pdf`),
        internal: true,
      });
    }
    if (inv.recycling) {
      docs.push({
        kind: 'Form 6',
        no: inv.recycling.form6No,
        inv: inv.invoiceNo,
        dt: inv.recycling.processedAt ?? '',
        note: `E-way ${inv.ewayBillNo || '—'}`,
        href: filesApi.pdf(`/invoices/${inv.id}/form6.pdf`),
      });
    }
    for (const c of inv.certificates) {
      docs.push({
        kind: 'Certificate',
        no: c.certNo,
        inv: inv.invoiceNo,
        dt: c.certDate ?? '',
        note: c.department || 'whole invoice',
        href: c.fileId ? filesApi.url(c.fileId) : undefined,
      });
    }
  }
  if (!docs.length) return null;
  const f6n = docs.filter((d) => d.kind === 'Form 6').length;
  const codn = docs.filter((d) => d.kind === 'Certificate').length;

  function downloadAll(kind: 'Form 6' | 'Certificate') {
    docs
      .filter((d) => d.kind === kind && d.href)
      .forEach((d, i) => {
        setTimeout(() => window.open(d.href, '_blank'), i * 350);
      });
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">📁 Compliance Documents</div>
        <span className="badge bg-gy">{docs.length}</span>
        <div className="spacer" />
        {codn > 1 ? (
          <button type="button" className="btn bs bsm" onClick={() => downloadAll('Certificate')}>
            ⬇ All certificates
          </button>
        ) : null}
        {f6n > 1 ? (
          <button type="button" className="btn bs bsm" onClick={() => downloadAll('Form 6')}>
            ⬇ All Form 6
          </button>
        ) : null}
      </div>
      <div className="dim" style={{ fontSize: '.78rem', marginBottom: '.5rem' }}>
        Every regulatory document raised against this request. Retained for a minimum of five years per
        Rule 12(4) of the E-Waste (Management) Rules, 2022; certificates for ten.
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
                <td className="dim">{fmtDate(dc.dt) || '—'}</td>
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
  resubmit,
  onSave,
}: {
  sub: SubmissionDetail;
  disabled: boolean;
  resubmit: boolean;
  onSave: (body: { location?: string; approxQty?: number; approxWeight?: number; notes?: string; ref?: string }) => void;
}) {
  const [location, setLocation] = useState(sub.location ?? '');
  const [approxQty, setApproxQty] = useState(String(sub.approxQty));
  const [approxWeight, setApproxWeight] = useState(String(sub.approxWeight));
  const [notes, setNotes] = useState(sub.notes ?? '');
  const [ref, setRef] = useState(sub.ref ?? '');

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
          ref,
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
        PO / Reference
        <input value={ref} onChange={(e) => setRef(e.target.value)} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>
      <button type="submit" className="btn primary" disabled={disabled}>
        {resubmit ? 'Save and resubmit' : 'Save changes'}
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
    logisticsPartner?: string;
    expectedAt?: string;
    team: Array<{ name: string; role: string; phone: string }>;
  }) => void;
}) {
  const vehicleTypes = useLookups('vehicleType');
  const logistics = useLookups('logistics');
  const teamRoles = useLookups('teamRole');
  const [registration, setRegistration] = useState('');
  const [vehicleType, setVehicleType] = useState('VT2');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [partner, setPartner] = useState('');
  const [expectedAt, setExpectedAt] = useState('');

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
          logisticsPartner: partner || undefined,
          expectedAt: expectedAt || undefined,
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
      <div className="fr2">
        <label>
          Logistics partner
          <select value={partner} onChange={(e) => setPartner(e.target.value)}>
            <option value="">Select…</option>
            {logistics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expected
          <input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
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
    manual?: boolean;
    gross?: number;
    tare?: number;
    net?: number;
    slipNumber?: string;
    reason?: string;
    slipPhotoIds: string[];
    pickupPhotoIds: string[];
  }) => void;
}) {
  const [manual, setManual] = useState(false);
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [net, setNet] = useState('');
  const [slip, setSlip] = useState('');
  const [reason, setReason] = useState('');
  const [slipPhotos, setSlipPhotos] = useState<string[]>([]);
  const [pickupPhotos, setPickupPhotos] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onWeigh(
          manual
            ? {
                weighedAt: today,
                manual: true,
                net: Number(net),
                reason,
                pickupPhotoIds: pickupPhotos,
                slipPhotoIds: [],
              }
            : {
                weighedAt: today,
                gross: Number(gross),
                tare: Number(tare),
                slipNumber: slip,
                slipPhotoIds: slipPhotos,
                pickupPhotoIds: pickupPhotos,
              },
        );
      }}
    >
      <h3>Weigh {vehicle.registration}</h3>
      <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
        Manual weighment (no weighbridge)
      </label>
      {manual ? (
        <>
          <label>
            Recorded net (kg)
            <input type="number" step="0.001" value={net} onChange={(e) => setNet(e.target.value)} required />
          </label>
          <label>
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Why the weighbridge was not used" />
          </label>
        </>
      ) : (
        <>
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
        </>
      )}
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
      <button
        type="submit"
        className="btn primary"
        disabled={disabled || !pickupPhotos.length || (!manual && !slipPhotos.length)}
      >
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
    taxRatePct?: number;
    invoiceFileId?: string;
    ewayFileId?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const taxRates = useLookups('taxRate');
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [taxableAmount, setTaxableAmount] = useState('10000');
  const [taxRate, setTaxRate] = useState('18');
  const [eway, setEway] = useState('EWB-DEMO-001');
  const [invoiceFileId, setInvoiceFileId] = useState('');
  const [ewayFileId, setEwayFileId] = useState('');

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
          taxRatePct: Number(taxRate),
          invoiceFileId: invoiceFileId || undefined,
          ewayFileId: ewayFileId || undefined,
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
        Tax rate
        <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)}>
          {taxRates.length ? (
            taxRates.map((t) => (
              <option key={t.id} value={String(t.rate ?? 18)}>
                {t.label}
              </option>
            ))
          ) : (
            <option value="18">GST 18%</option>
          )}
        </select>
      </label>
      <label>
        E-way bill no.
        <input value={eway} onChange={(e) => setEway(e.target.value)} required />
      </label>
      <FileUpload
        kind="invoice"
        label="Invoice PDF"
        accept="application/pdf"
        disabled={disabled}
        value={invoiceFileId ? [invoiceFileId] : []}
        onChange={(ids) => setInvoiceFileId(ids[0] ?? '')}
      />
      <FileUpload
        kind="eway"
        label="E-way bill PDF"
        accept="application/pdf"
        disabled={disabled}
        value={ewayFileId ? [ewayFileId] : []}
        onChange={(ids) => setEwayFileId(ids[0] ?? '')}
      />
      <button type="submit" className="btn primary" disabled={disabled}>
        Create invoice
      </button>
    </form>
  );
}
