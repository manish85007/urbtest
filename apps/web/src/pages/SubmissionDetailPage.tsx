import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPayStatus, formatINR, rupeesToPaise } from '@urb-tectrack/shared';
import { dataApi, filesApi, lifecycleApi, type SessionUser, type SubmissionDetail, type VehicleDetail } from '../api';
import { StageBadge, StageProgress } from '../components/StageProgress';
import { InvoiceLifecyclePanel } from '../components/InvoiceLifecyclePanel';
import { FileUpload } from '../components/FileUpload';
import { FileRow, FileThumb } from '../components/FileThumb';
import { QueryThread } from '../components/QueryThread';
import { PhoneField } from '../components/PhoneField';
import { Modal } from '../components/Modal';
import { EMPTY_LINE, LineItemsEditor, namedDraftLines, type DraftLine } from '../components/LineItemsEditor';
import { lookupLabel, useLookups } from '../hooks/useLookups';
import { fmtDate, fmtTS, num } from '../lib/format';

type StepModal =
  | { kind: 'ack' }
  | { kind: 'reject' }
  | { kind: 'vehicle'; vehicleId?: string }
  | { kind: 'weigh'; vehicleId: string }
  | { kind: 'invoice' }
  | { kind: 'edit' };

export function SubmissionDetailPage({ user }: { user: SessionUser }) {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [invTab, setInvTab] = useState('');
  const [step, setStep] = useState<StepModal | null>(null);

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

  useEffect(() => {
    if (user.role === 'client' && sub?.derivedStage === 1 && sub.rejectNote) {
      setStep({ kind: 'edit' });
    }
  }, [user.role, sub?.id, sub?.derivedStage, sub?.rejectNote]);

  async function act(fn: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
      setMsg(success);
      setStep(null);
      load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return false;
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
  const weighTarget =
    step?.kind === 'weigh' ? sub.vehicles.find((v) => v.id === step.vehicleId) : unweighed[0];
  const vehicleTarget =
    step?.kind === 'vehicle' && step.vehicleId
      ? sub.vehicles.find((v) => v.id === step.vehicleId)
      : undefined;
  const showResubmit = user.role === 'client' && stage === 1 && !!sub.rejectNote;

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
          <button type="button" className="btn bp" disabled={busy} onClick={() => setStep({ kind: 'ack' })}>
            ✅ Acknowledge Request
          </button>
        ) : null}
        {isStaff && stage === 3 ? (
          <button type="button" className="btn bp" onClick={() => setStep({ kind: 'vehicle' })}>
            🚚 Assign Vehicle
          </button>
        ) : null}
        {isAdmin && stage === 4 && unweighed.length ? (
          <button
            type="button"
            className="btn bp"
            onClick={() => setStep({ kind: 'weigh', vehicleId: unweighed[0].id })}
          >
            ⚖️ Weigh ({unweighed.length} pending)
          </button>
        ) : null}
        {isAdmin && stage === 5 && allWeighed ? (
          <button type="button" className="btn bp" onClick={() => setStep({ kind: 'invoice' })}>
            {sub.invoices.length ? '🧾 Add Invoice' : '🧾 Raise Invoice'}
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
            onEdit={() => setStep({ kind: 'edit' })}
            onBom={(bomFileId) =>
              act(() => lifecycleApi.updateSubmission(sub.id, { bomFileId }), 'Bill of materials updated.')
            }
          />

          {isAdmin && stage === 1 ? (
            <div className="card">
              <div className="card-ttl">Acknowledge request</div>
              <p className="p-mu">
                Accepting this request moves it to Assign Vehicle and sends an acknowledgement email to
                the requestor. Use the header action, or request changes.
              </p>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setStep({ kind: 'reject' })}>
                Request changes
              </button>
            </div>
          ) : null}

          <VehicleCard
            sub={sub}
            user={user}
            netKg={netKg}
            onAddVehicle={() => setStep({ kind: 'vehicle' })}
            onEditVehicle={(vehicleId) => setStep({ kind: 'vehicle', vehicleId })}
            onWeighVehicle={(vehicleId) => setStep({ kind: 'weigh', vehicleId })}
          />

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
                {isAdmin && allWeighed ? (
                  <button
                    type="button"
                    className="inv-tab"
                    style={{ color: 'var(--g)', fontWeight: 700 }}
                    onClick={() => setStep({ kind: 'invoice' })}
                  >
                    + Invoice
                  </button>
                ) : null}
              </div>
              {activeInv ? (
                <InvoiceLifecyclePanel
                  invoice={activeInv}
                  vehicles={sub.vehicles}
                  lineItems={sub.items ?? []}
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

      {step?.kind === 'ack' ? (
        <Modal
          title={`Acknowledge Request — ${sub.id}`}
          onClose={() => setStep(null)}
          okLabel="Acknowledge"
          busy={busy}
          onOk={() => act(() => lifecycleApi.acknowledge(sub.id), 'Request acknowledged.')}
        >
          <p style={{ fontSize: '.87rem', marginBottom: '.8rem' }}>
            Accepting this request moves it to <b>Assign Vehicle</b> and sends an automatic acknowledgement
            email to the requestor.
          </p>
          <div className="card" style={{ background: 'var(--g5)', marginBottom: '.7rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '.4rem' }}>
              <div className="tile">
                <div className="tile-l">Client</div>
                <div className="tile-v">{sub.client.name}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Site</div>
                <div className="tile-v">{sub.site.name}</div>
              </div>
              <div className="tile">
                <div className="tile-l">Approx</div>
                <div className="tile-v">
                  {num(Number(sub.approxWeight))} kg · {sub.approxQty} units
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">Requestor</div>
                <div className="tile-v">{sub.createdBy}</div>
              </div>
            </div>
            {sub.notes ? (
              <div className="tile" style={{ marginTop: '.4rem' }}>
                <div className="tile-l">Client notes</div>
                <div className="tile-v" style={{ fontWeight: 400 }}>
                  {sub.notes}
                </div>
              </div>
            ) : null}
          </div>
          <div
            style={{
              background: 'var(--bl2)',
              padding: '.55rem .8rem',
              borderRadius: 8,
              fontSize: '.78rem',
              color: 'var(--bl)',
            }}
          >
            📧 Email will be sent to <b>{sub.createdBy}</b> using the Request Acknowledgement template.
          </div>
        </Modal>
      ) : null}

      {step?.kind === 'reject' ? (
        <Modal
          title={`Request changes — ${sub.id}`}
          onClose={() => setStep(null)}
          okLabel="Send back to client"
          form="reject-form"
          busy={busy}
        >
          <RejectForm
            formId="reject-form"
            disabled={busy}
            onReject={(reason) => act(() => lifecycleApi.reject(sub.id, reason), 'Changes requested from client.')}
          />
        </Modal>
      ) : null}

      {step?.kind === 'vehicle' ? (
        <Modal
          title={
            vehicleTarget
              ? `Edit Vehicle — ${vehicleTarget.registration}`
              : `Assign Vehicle — ${sub.id}`
          }
          onClose={() => setStep(null)}
          okLabel={vehicleTarget ? 'Save Vehicle' : 'Assign vehicle'}
          form="assign-vehicle-form"
          busy={busy}
          wide
        >
          <AssignVehicleForm
            formId="assign-vehicle-form"
            vehicle={vehicleTarget}
            disabled={busy}
            onAssign={(body) =>
              vehicleTarget
                ? act(() => lifecycleApi.updateVehicle(vehicleTarget.id, body), 'Vehicle updated.')
                : act(() => lifecycleApi.addVehicle(sub.id, body), 'Vehicle assigned.')
            }
          />
        </Modal>
      ) : null}

      {step?.kind === 'weigh' && weighTarget ? (
        <Modal
          title={`Weighment — ${weighTarget.registration}`}
          onClose={() => setStep(null)}
          okLabel="Record weighment"
          form="weigh-form"
          busy={busy}
          wide
        >
          <WeighForm
            formId="weigh-form"
            vehicle={weighTarget}
            disabled={busy}
            onWeigh={(body) => act(() => lifecycleApi.weigh(weighTarget.id, body), 'Weighment recorded.')}
          />
        </Modal>
      ) : null}

      {step?.kind === 'invoice' ? (
        <Modal
          title={`Raise Invoice — ${sub.id}`}
          onClose={() => setStep(null)}
          okLabel="Create invoice"
          form="invoice-form"
          busy={busy}
          wide
        >
          <InvoiceForm
            formId="invoice-form"
            vehicles={sub.vehicles}
            disabled={busy}
            onCreate={(body) => act(() => lifecycleApi.createInvoice(sub.id, body), 'Invoice created.')}
          />
        </Modal>
      ) : null}

      {step?.kind === 'edit' ? (
        <Modal
          title={`Edit Request — ${sub.id}`}
          onClose={() => setStep(null)}
          okLabel={showResubmit ? 'Save and resubmit' : 'Save changes'}
          form="edit-request-form"
          busy={busy}
          wide
        >
          <EditRequestForm
            formId="edit-request-form"
            sub={sub}
            disabled={busy}
            resubmit={showResubmit}
            onSave={(body) =>
              act(
                () => lifecycleApi.updateSubmission(sub.id, body),
                showResubmit ? 'Request updated and sent back to Urbeno.' : 'Request updated.',
              )
            }
          />
        </Modal>
      ) : null}
    </div>
  );
}

function RequestCard({
  sub,
  user,
  busy,
  onEdit,
  onBom,
}: {
  sub: SubmissionDetail;
  user: SessionUser;
  busy: boolean;
  onEdit: () => void;
  onBom: (bomFileId: string | null) => void;
}) {
  const isClient = user.role === 'client';
  const isAdmin = user.role === 'admin';
  const closed = !!sub.closedAt;
  const canEdit = !closed && (isAdmin || (isClient && sub.derivedStage === 1 && !!sub.rejectNote));
  const showResubmit = isClient && sub.derivedStage === 1 && !!sub.rejectNote;

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">📝 Request Details</div>
        <div className="spacer" />
        {showResubmit ? <span className="badge bg-am">Update in the popup</span> : null}
        {canEdit ? (
          <button type="button" className="btn bs bsm" onClick={onEdit}>
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
          <a
            className="btn bs bsm"
            href={filesApi.url(sub.bomFileId)}
            target="_blank"
            rel="noreferrer"
            style={{ fontWeight: 400 }}
          >
            📄 View BoM
          </a>
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
      {(sub.items ?? []).length ? (
        <div className="tw" style={{ marginTop: '.6rem' }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Weight</th>
                <th>HSN</th>
                <th>Category</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {sub.items!.map((i) => {
                const inv = sub.invoices.find((x) => x.id === i.invoiceId);
                return (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="mono">{i.qty}</td>
                    <td className="mono">{num(Number(i.weightKg))} kg</td>
                    <td className="mono dim">{i.hsn || '—'}</td>
                    <td>
                      {i.categoryId ? <span className="badge bg-bl">{i.categoryId}</span> : <span className="dim">—</span>}
                    </td>
                    <td>
                      {inv ? <span className="badge bg-gy">{inv.invoiceNo}</span> : <span className="dim">—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--g3)', fontWeight: 700 }}>
                <td>Declared total</td>
                <td className="mono">{sub.items!.reduce((a, i) => a + i.qty, 0)}</td>
                <td className="mono">
                  {num(sub.items!.reduce((a, i) => a + Number(i.weightKg), 0))} kg
                </td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function VehicleCard({
  sub,
  user,
  netKg,
  onAddVehicle,
  onEditVehicle,
  onWeighVehicle,
}: {
  sub: SubmissionDetail;
  user: SessionUser;
  netKg: number;
  onAddVehicle: () => void;
  onEditVehicle: (vehicleId: string) => void;
  onWeighVehicle: (vehicleId: string) => void;
}) {
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const isAdmin = user.role === 'admin';
  const stage = sub.derivedStage;
  const vehicleTypes = useLookups('vehicleType');
  const logistics = useLookups('logistics');
  const teamRoles = useLookups('teamRole');

  if (!sub.vehicles.length && stage < 3) return null;

  const canAdd = isStaff && stage >= 3 && stage <= 5;
  const canEditVehicle = isStaff && !sub.closedAt;

  return (
    <div className="card" id="assign-vehicle">
      <div className="card-hd">
        <div className="card-ttl">🚚 Vehicles & Weighment ({sub.vehicles.length})</div>
        <div className="spacer" />
        {netKg ? <span className="badge bg-g">{num(netKg)} kg net</span> : null}
        {canAdd ? (
          <button type="button" className="btn bs bsm" onClick={onAddVehicle}>
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
                <div className="spacer" />
                {canEditVehicle ? (
                  <button type="button" className="btn bs bsm" onClick={() => onEditVehicle(v.id)}>
                    Edit vehicle
                  </button>
                ) : null}
                {isAdmin && !w && stage >= 4 && stage <= 5 ? (
                  <button type="button" className="btn bp bsm" onClick={() => onWeighVehicle(v.id)}>
                    Record Weighment
                  </button>
                ) : null}
                {isAdmin && w && stage >= 4 && stage <= 5 ? (
                  <button type="button" className="btn bs bsm" onClick={() => onWeighVehicle(v.id)}>
                    Edit weighment
                  </button>
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
              {v.changeRemark ? (
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
                  <b style={{ color: 'var(--am)' }}>Vehicle change:</b> {v.changeRemark}
                </div>
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
        <div className="tile-l">Request Date</div>
        <div className="tile-v">{fmtDate(sub.requestDate)}</div>
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
            Go to invoice
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
  formId,
}: {
  sub: SubmissionDetail;
  disabled: boolean;
  resubmit: boolean;
  formId?: string;
  onSave: (body: {
    location?: string;
    approxQty?: number;
    approxWeight?: number;
    notes?: string;
    ref?: string;
    siteId?: string;
    requestDate?: string;
    items?: Array<{ name: string; qty?: number; weightKg?: number; hsn?: string }>;
  }) => void;
}) {
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [siteId, setSiteId] = useState(sub.siteId);
  const [requestDate, setRequestDate] = useState(sub.requestDate.slice(0, 10));
  const [location, setLocation] = useState(sub.location ?? '');
  const [approxQty, setApproxQty] = useState(String(sub.approxQty));
  const [approxWeight, setApproxWeight] = useState(String(sub.approxWeight));
  const [notes, setNotes] = useState(sub.notes ?? '');
  const [ref, setRef] = useState(sub.ref ?? '');
  const [items, setItems] = useState<DraftLine[]>(
    sub.items?.length
      ? sub.items.map((i) => ({
          n: i.name,
          q: String(i.qty || ''),
          w: String(i.weightKg ?? ''),
          hsn: i.hsn || '854890',
        }))
      : [{ ...EMPTY_LINE }],
  );

  useEffect(() => {
    dataApi.sites(sub.clientId, true).then(setSites).catch(() => setSites([]));
  }, [sub.clientId]);

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        const named = namedDraftLines(items);
        onSave({
          siteId,
          requestDate,
          location,
          approxQty: Number(approxQty),
          approxWeight: Number(approxWeight),
          notes,
          ref,
          items: named,
        });
      }}
    >
      <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.8rem' }}>
        {resubmit
          ? 'You can edit this request until Urbeno acknowledges it.'
          : 'Admin edit — all changes are audit-logged.'}
      </p>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="er-site">Site</label>
          <select id="er-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {(sites.length ? sites : [{ id: sub.siteId, name: sub.site.name, code: sub.site.code }]).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="er-loc">Pickup Location</label>
          <input id="er-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="er-ref">PO / Reference</label>
          <input id="er-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="er-date">Request Date</label>
          <input id="er-date" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="er-qty">Approx. Quantity</label>
          <input id="er-qty" type="number" value={approxQty} onChange={(e) => setApproxQty(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="er-wt">Approx. Weight (kg)</label>
          <input
            id="er-wt"
            type="number"
            step="0.1"
            value={approxWeight}
            onChange={(e) => setApproxWeight(e.target.value)}
          />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="er-notes">Notes</label>
        <textarea id="er-notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 52 }} />
      </div>
      <LineItemsEditor items={items} onChange={setItems} />
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          {resubmit ? 'Save and resubmit' : 'Save changes'}
        </button>
      )}
    </form>
  );
}

function RejectForm({
  disabled,
  onReject,
  formId,
}: {
  disabled: boolean;
  formId?: string;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onReject(reason);
        setReason('');
      }}
    >
      <div className="fg">
        <label htmlFor="ak-rej">Note to client</label>
        <textarea
          id="ak-rej"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder="e.g. Please split this into two requests, one per site."
        />
      </div>
      {formId ? null : (
        <button type="submit" className="btn secondary" disabled={disabled || !reason.trim()}>
          Send back to client
        </button>
      )}
    </form>
  );
}

function localDateTimeValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AssignVehicleForm({
  disabled,
  onAssign,
  formId,
  vehicle,
}: {
  disabled: boolean;
  formId?: string;
  vehicle?: VehicleDetail;
  onAssign: (body: {
    registration: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    logisticsPartner?: string;
    expectedAt?: string;
    changeRemark?: string;
    team: Array<{ name: string; role: string; phone: string }>;
  }) => void;
}) {
  const vehicleTypes = useLookups('vehicleType');
  const logistics = useLookups('logistics');
  const teamRoles = useLookups('teamRole');
  const [registration, setRegistration] = useState(vehicle?.registration ?? '');
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? 'VT2');
  const [driverName, setDriverName] = useState(vehicle?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(vehicle?.driverPhone ?? '');
  const [partner, setPartner] = useState(vehicle?.logisticsPartner ?? '');
  const [expectedAt, setExpectedAt] = useState(
    vehicle?.expectedAt ? localDateTimeValue(new Date(vehicle.expectedAt)) : localDateTimeValue(),
  );
  const [remark, setRemark] = useState(vehicle?.changeRemark ?? '');
  const [team, setTeam] = useState<Array<{ name: string; role: string; phone: string }>>(() => {
    if (!vehicle?.team?.length) return [];
    return vehicle.team.filter(
      (t, i) => !(i === 0 && t.name === vehicle.driverName),
    );
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!partner && logistics[0]) setPartner(logistics[0].id);
  }, [logistics, partner]);

  useEffect(() => {
    if (vehicleTypes[0] && !vehicleTypes.some((v) => v.id === vehicleType)) {
      setVehicleType(vehicleTypes[0].id);
    }
  }, [vehicleTypes, vehicleType]);

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!expectedAt) {
          setError('Expected pickup date and time is required.');
          return;
        }
        if (!driverPhone) {
          setError('Driver phone is required.');
          return;
        }
        const extra = team.filter((t) => t.name.trim() || t.phone.trim());
        if (extra.some((t) => !t.name.trim() || !t.phone.trim() || !t.role.trim())) {
          setError('Every team member needs a name, role and 10-digit phone.');
          return;
        }
        const identityChanged =
          !!vehicle &&
          (registration.trim().toUpperCase() !== vehicle.registration.toUpperCase() ||
            vehicleType !== vehicle.vehicleType);
        if (identityChanged && !remark.trim()) {
          setError(
            'Record a remark when changing the vehicle number or type (for example a breakdown or replacement).',
          );
          return;
        }
        onAssign({
          registration,
          vehicleType,
          driverName,
          driverPhone,
          logisticsPartner: partner || undefined,
          expectedAt: expectedAt || undefined,
          changeRemark: remark.trim() || undefined,
          team: extra,
        });
      }}
    >
      <h3>{vehicle ? 'Edit vehicle' : 'Assign vehicle'}</h3>
      <p className="dim" style={{ fontSize: '.82rem', margin: '-.3rem 0 .7rem' }}>
        {vehicle
          ? 'Update registration or type if the vehicle broke down or was replaced. A remark is required for those changes.'
          : 'Assign as many vehicles as this pickup needs. Each vehicle carries its own team and weighment.'}
      </p>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="vh-reg">Registration</label>
          <input
            id="vh-reg"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            required
            placeholder="KA-01-AB-1234"
            style={{ fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}
          />
        </div>
        <div className="fg">
          <label htmlFor="vh-type">Vehicle type</label>
          <select id="vh-type" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {vehicleTypes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="vh-lp">Logistics partner</label>
          <select id="vh-lp" value={partner} onChange={(e) => setPartner(e.target.value)} required>
            {logistics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="vh-exp">Expected pickup</label>
          <input
            id="vh-exp"
            type="datetime-local"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
            required
          />
        </div>
        <div className="fg">
          <label htmlFor="vh-drv">Driver name</label>
          <input id="vh-drv" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
        </div>
        <PhoneField label="Driver phone" value={driverPhone} onChange={setDriverPhone} required />
      </div>
      {vehicle ? (
        <div className="fg">
          <label htmlFor="vh-remark">Change remark</label>
          <textarea
            id="vh-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={2}
            placeholder="Required if registration or vehicle type changes — e.g. breakdown at site, replacement vehicle KA-…"
          />
        </div>
      ) : null}
      <div className="section-hd" style={{ marginTop: '.2rem' }}>
        Pickup team <span className="hint">every extra person on this vehicle, with phone</span>
      </div>
      {team.map((t, i) => (
        <div className="fr3" key={i} style={{ alignItems: 'end' }}>
          <div className="fg">
            <label>Name</label>
            <input
              placeholder="Full name"
              value={t.name}
              onChange={(e) => setTeam((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            />
          </div>
          <div className="fg">
            <label>Role</label>
            <select
              value={t.role}
              onChange={(e) => setTeam((rows) => rows.map((r, j) => (j === i ? { ...r, role: e.target.value } : r)))}
            >
              {teamRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '.35rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <PhoneField
                label="Mobile"
                id={`tm-ph-${i}`}
                value={t.phone}
                onChange={(ph) => setTeam((rows) => rows.map((r, j) => (j === i ? { ...r, phone: ph } : r)))}
              />
            </div>
            <button
              type="button"
              className="btn brd bsm"
              style={{ marginBottom: '.65rem' }}
              onClick={() => setTeam((rows) => rows.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn bs bsm"
        onClick={() => setTeam((rows) => [...rows, { name: '', role: teamRoles[1]?.id ?? teamRoles[0]?.id ?? 'TR2', phone: '' }])}
      >
        + Add Team Member
      </button>
      {error ? <p className="error">{error}</p> : null}
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled} style={{ marginTop: '.6rem' }}>
          {vehicle ? 'Save Vehicle' : 'Assign vehicle'}
        </button>
      )}
    </form>
  );
}

function WeighForm({
  vehicle,
  disabled,
  onWeigh,
  formId,
}: {
  vehicle: { registration: string };
  disabled: boolean;
  formId?: string;
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
  const [manualNet, setManualNet] = useState('');
  const [slip, setSlip] = useState('');
  const [reason, setReason] = useState('');
  const [slipPhotos, setSlipPhotos] = useState<string[]>([]);
  const [pickupPhotos, setPickupPhotos] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const grossNum = parseFloat(gross) || 0;
  const tareNum = parseFloat(tare) || 0;
  const netKg = grossNum > 0 && tareNum > 0 && grossNum > tareNum ? grossNum - tareNum : null;

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError('');
        if (!pickupPhotos.length) {
          setFormError('Attach at least one pickup photo.');
          return;
        }
        if (manual) {
          onWeigh({
            weighedAt: today,
            manual: true,
            net: Number(manualNet),
            reason,
            pickupPhotoIds: pickupPhotos,
            slipPhotoIds: [],
          });
        } else {
          if (!slipPhotos.length) {
            setFormError('Attach at least one weighment slip photo.');
            return;
          }
          onWeigh({
            weighedAt: today,
            gross: Number(gross),
            tare: Number(tare),
            slipNumber: slip,
            slipPhotoIds: slipPhotos,
            pickupPhotoIds: pickupPhotos,
          });
        }
      }}
    >
      <h3>Weigh {vehicle.registration}</h3>
      <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginBottom: '.7rem' }}>
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
        Manual weighment (no weighbridge)
      </label>
      {manual ? (
        <>
          <div className="fr3">
            <div className="fg">
              <label>Recorded net (kg) *</label>
              <input type="number" step="0.001" value={manualNet} onChange={(e) => setManualNet(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Method used *</label>
              <select value={reason.startsWith('Method:') ? reason.split('|')[0].replace('Method:', '').trim() : ''} onChange={(e) => setReason(`Method: ${e.target.value}`)}>
                {['Floor scale', 'Platform scale', 'Crane scale', 'Counted and weighed by unit', 'Client-supplied figure'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fg">
            <label>Why the weighbridge was not used *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} placeholder="e.g. Client site does not permit vehicles on the weighbridge; 42 kg weighed on the floor scale." />
          </div>
        </>
      ) : (
        <>
          <div className="fr3">
            <div className="fg">
              <label>Gross Weight (kg) *</label>
              <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Tare Weight (kg) *</label>
              <input type="number" step="0.001" value={tare} onChange={(e) => setTare(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Net Weight (kg)</label>
              <input
                type="text"
                value={netKg !== null ? netKg.toFixed(3) : '—'}
                disabled
                style={{ fontWeight: 700, color: netKg !== null ? 'var(--g)' : 'var(--g2)' }}
              />
            </div>
          </div>
          <div className="fg">
            <label>Weighment Slip # *</label>
            <input value={slip} onChange={(e) => setSlip(e.target.value)} required placeholder="WS-0042" style={{ fontFamily: 'ui-monospace, monospace' }} />
          </div>
          <FileUpload
            kind="weighPhoto"
            label="Weighment slip photos"
            hint="At least 1 photo · max 5 MB each · JPG/PNG/PDF"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={disabled}
            value={slipPhotos}
            onChange={setSlipPhotos}
          />
        </>
      )}
      <FileUpload
        kind="pickPhoto"
        label="Pickup photos"
        hint="At least 1 photo · max 5 MB each · JPG/PNG"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        value={pickupPhotos}
        onChange={setPickupPhotos}
      />
      {formError ? <p className="error">{formError}</p> : null}
      {formId ? null : (
        <button
          type="submit"
          className="btn primary"
          disabled={disabled || !pickupPhotos.length || (!manual && !slipPhotos.length)}
        >
          Record weighment
        </button>
      )}
    </form>
  );
}

function InvoiceForm({
  vehicles,
  disabled,
  onCreate,
  formId,
}: {
  vehicles: Array<{ id: string; registration: string; weighment: { netKg: string } | null }>;
  disabled: boolean;
  formId?: string;
  onCreate: (body: {
    invoiceNo: string;
    invoiceDate: string;
    taxableAmount: number;
    ewayBillNo: string;
    ewayBillDate: string;
    vehicleIds: string[];
    taxRatePct?: number;
    billingWeight?: number;
    deviationNote?: string;
    billingMode?: string;
    invoiceFileId?: string;
    ewayFileId?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const taxRates = useLookups('taxRate');
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [taxableAmount, setTaxableAmount] = useState('10000');
  const [taxRateId, setTaxRateId] = useState('TX18');
  const [billingMode, setBillingMode] = useState<'urbeno' | 'client'>('urbeno');
  const [eway, setEway] = useState('EWB-DEMO-001');
  const [ewayDate, setEwayDate] = useState(today);
  const [vehIds, setVehIds] = useState<string[]>(() => vehicles.map((v) => v.id));
  const [billingWeight, setBillingWeight] = useState('');
  const [weightTouched, setWeightTouched] = useState(false);
  const [deviationNote, setDeviationNote] = useState('');
  const [invoiceFileId, setInvoiceFileId] = useState('');
  const [ewayFileId, setEwayFileId] = useState('');
  const [error, setError] = useState('');

  const selectedRate = taxRates.find((t) => t.id === taxRateId) ?? taxRates.find((t) => Number(t.rate) === 18);
  const taxPct = Number(selectedRate?.rate ?? 18);
  const taxable = Number(taxableAmount) || 0;
  const taxValue = +(taxable * taxPct) / 100;
  const totalValue = taxable + taxValue;
  const vehNet = vehicles
    .filter((v) => vehIds.includes(v.id))
    .reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);
  const billWt = weightTouched ? Number(billingWeight) || 0 : vehNet;
  const deviation = +(billWt - vehNet).toFixed(2);
  const needsNote = Math.abs(deviation) >= 0.01;

  useEffect(() => {
    if (!weightTouched) setBillingWeight(vehNet ? String(vehNet) : '');
  }, [vehNet, weightTouched]);

  useEffect(() => {
    if (taxRates.length && !taxRates.some((t) => t.id === taxRateId)) {
      const eighteen = taxRates.find((t) => Number(t.rate) === 18);
      setTaxRateId(eighteen?.id ?? taxRates[0].id);
    }
  }, [taxRates, taxRateId]);

  function toggleVeh(id: string) {
    setVehIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setWeightTouched(false);
  }

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!vehIds.length) {
          setError('Select at least one vehicle covered by this invoice.');
          return;
        }
        if (needsNote && !deviationNote.trim()) {
          setError(
            `Billing weight (${billWt} kg) does not match the weighed vehicle net (${vehNet} kg). Record a deviation note.`,
          );
          return;
        }
        onCreate({
          invoiceNo,
          invoiceDate,
          taxableAmount: taxable,
          ewayBillNo: eway,
          ewayBillDate: ewayDate,
          vehicleIds: vehIds,
          taxRatePct: taxPct,
          billingWeight: billWt || undefined,
          deviationNote: needsNote ? deviationNote.trim() : undefined,
          billingMode,
          invoiceFileId: invoiceFileId || undefined,
          ewayFileId: ewayFileId || undefined,
        });
      }}
    >
      <h3>Raise invoice</h3>
      <p className="dim" style={{ fontSize: '.82rem', margin: '-.3rem 0 .7rem' }}>
        Each invoice needs its own e-way bill and progresses independently through MRN, recycling, certificate and
        closure.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <div className="fg">
          <label htmlFor="iv-no">Invoice no.</label>
          <input
            id="iv-no"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            required
            style={{ fontFamily: 'ui-monospace, monospace' }}
          />
        </div>
        <div className="fg">
          <label htmlFor="iv-dt">Invoice date</label>
          <input id="iv-dt" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
        </div>
      </div>
      <div className="fr3">
        <div className="fg">
          <label htmlFor="iv-amt">Taxable amount (₹)</label>
          <input
            id="iv-amt"
            type="number"
            min="0"
            step="0.01"
            value={taxableAmount}
            onChange={(e) => setTaxableAmount(e.target.value)}
            required
          />
        </div>
        <div className="fg">
          <label htmlFor="iv-tax">Tax rate</label>
          <select id="iv-tax" value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)}>
            {taxRates.length ? (
              taxRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))
            ) : (
              <option value="TX18">GST 18%</option>
            )}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="iv-gst">Tax value (₹)</label>
          <input id="iv-gst" value={formatINR(rupeesToPaise(taxValue))} disabled style={{ fontWeight: 700, color: 'var(--g2)' }} />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="iv-tot">Total invoice value (₹)</label>
        <input
          id="iv-tot"
          value={formatINR(rupeesToPaise(totalValue))}
          disabled
          style={{ fontWeight: 800, color: 'var(--g2)', fontSize: '1rem' }}
        />
      </div>
      <div className="dim" style={{ fontSize: '.74rem', margin: '-.3rem 0 .6rem' }}>
        {formatINR(rupeesToPaise(taxable))} taxable + {formatINR(rupeesToPaise(taxValue))} at {taxPct}% ={' '}
        {formatINR(rupeesToPaise(totalValue))}
        {selectedRate?.description ? ` · ${selectedRate.description}` : ''}
      </div>
      <div className="fg">
        <label htmlFor="iv-mode">Invoice mode</label>
        <select id="iv-mode" value={billingMode} onChange={(e) => setBillingMode(e.target.value as 'urbeno' | 'client')}>
          <option value="urbeno">Urbeno raises invoice (Urbeno → Client)</option>
          <option value="client">Client raises invoice (Client → Urbeno)</option>
        </select>
      </div>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="iv-ew">E-way bill no.</label>
          <input
            id="iv-ew"
            value={eway}
            onChange={(e) => setEway(e.target.value)}
            required
            style={{ fontFamily: 'ui-monospace, monospace' }}
          />
        </div>
        <div className="fg">
          <label htmlFor="iv-ewdt">E-way bill date</label>
          <input id="iv-ewdt" type="date" value={ewayDate} onChange={(e) => setEwayDate(e.target.value)} required />
        </div>
      </div>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="iv-wt">Billing weight (kg)</label>
          <input
            id="iv-wt"
            type="number"
            step="0.01"
            value={weightTouched ? billingWeight : vehNet ? String(vehNet) : billingWeight}
            onChange={(e) => {
              setWeightTouched(true);
              setBillingWeight(e.target.value);
            }}
          />
          <div className="dim" style={{ fontSize: '.74rem', marginTop: '.2rem' }}>
            {needsNote ? (
              <span style={{ color: 'var(--am)' }}>
                ⚠ {deviation > 0 ? 'Exceeds' : 'Short of'} the weighed net by {Math.abs(deviation)} kg — a deviation
                note is required
              </span>
            ) : (
              <span style={{ color: 'var(--g)' }}>✓ Matches the weighed vehicle net</span>
            )}
          </div>
        </div>
        <div className="fg">
          <label htmlFor="iv-vnet">Weighed vehicle net (kg)</label>
          <input id="iv-vnet" value={vehNet ? vehNet.toFixed(2) : '—'} disabled style={{ fontWeight: 700, color: 'var(--g2)' }} />
        </div>
      </div>
      {needsNote ? (
        <div className="fg">
          <label htmlFor="iv-dev">
            Deviation note * <span className="hint">billing weight differs from the weighed net — record why</span>
          </label>
          <textarea
            id="iv-dev"
            value={deviationNote}
            onChange={(e) => setDeviationNote(e.target.value)}
            placeholder="e.g. 6 kg of packaging returned to the client and excluded from billing."
            style={{ minHeight: 48 }}
          />
        </div>
      ) : null}
      <div className="fg">
        <label>Vehicles covered by this invoice *</label>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '.25rem',
            padding: '.35rem',
            border: '1px solid var(--bd)',
            borderRadius: 8,
            maxHeight: 130,
            overflowY: 'auto',
          }}
        >
          {vehicles.length ? (
            vehicles.map((v) => (
              <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.83rem', fontWeight: 400 }}>
                <input type="checkbox" checked={vehIds.includes(v.id)} onChange={() => toggleVeh(v.id)} />
                <span className="mono">{v.registration}</span>
                <span className="dim">
                  {v.weighment ? `${num(Number(v.weighment.netKg))} kg` : 'not weighed'}
                </span>
              </label>
            ))
          ) : (
            <span className="dim" style={{ fontSize: '.8rem' }}>
              No vehicles on this request
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem', marginTop: '.5rem' }}>
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
      </div>
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          Create invoice
        </button>
      )}
    </form>
  );
}
