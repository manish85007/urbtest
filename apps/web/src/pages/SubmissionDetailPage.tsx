import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getPayStatus, formatINR, paiseToRupees, rupeesToPaise, VIEW_PHASES, viewPhaseForStage, recyclingSla, SLA_CLASS, SLA_LABEL, settledPaise } from '@urb-tectrack/shared';
import {
  dataApi,
  filesApi,
  lifecycleApi,
  type InvoiceDetail,
  type SessionUser,
  type SubmissionDetail,
  type VehicleDetail,
} from '../api';
import { CollapsibleCard } from '../components/CollapsibleCard';
import { StageBadge, StageProgress } from '../components/StageProgress';
import { InvoiceLifecyclePanel, invoiceHasGoodsReceipt } from '../components/InvoiceLifecyclePanel';
import { WorkflowSection } from '../components/WorkflowSection';
import { FileUpload } from '../components/FileUpload';
import { FileRow } from '../components/FileThumb';
import { QueryThread } from '../components/QueryThread';
import { RequestLifecycleCard } from '../components/RequestLifecycleCard';
import { DateField } from '../components/DateField';
import { DateTimeField } from '../components/DateTimeField';
import { PhoneField } from '../components/PhoneField';
import { Modal } from '../components/Modal';
import { EMPTY_LINE, LineItemsEditor, namedDraftLines, type DraftLine } from '../components/LineItemsEditor';
import { lookupLabel, useLookups } from '../hooks/useLookups';
import { fmtDate, fmtTS, num, todayIso } from '../lib/format';
import { defaultDateTimeValue, localDateIso, splitDateTime } from '../lib/datetime';
import { isStaffUser, userCan } from '../lib/permissions';

type StepModal =
  | { kind: 'ack' }
  | { kind: 'reject' }
  | { kind: 'vehicle'; vehicleId?: string }
  | { kind: 'weigh'; vehicleId: string }
  | { kind: 'invoice'; invoiceId?: string }
  | { kind: 'edit' };

function bomFilesOf(sub: SubmissionDetail): string[] {
  if (sub.bomFileIds?.length) return sub.bomFileIds;
  return sub.bomFileId ? [sub.bomFileId] : [];
}

/** Client portal user who receives lifecycle emails (matches API submission-notify). */
function clientEmailRecipient(sub: Pick<SubmissionDetail, 'onBehalfOf' | 'createdBy'>): string {
  const onBehalf = sub.onBehalfOf?.trim();
  if (onBehalf) return onBehalf;
  return sub.createdBy;
}

function invoicePdfIds(inv?: InvoiceDetail | null) {
  if (!inv) return [];
  if (inv.invoiceFileIds?.length) return inv.invoiceFileIds;
  return inv.invoiceFileId ? [inv.invoiceFileId] : [];
}

function ewayPdfIds(inv?: InvoiceDetail | null) {
  if (!inv) return [];
  if (inv.ewayFileIds?.length) return inv.ewayFileIds;
  return inv.ewayFileId ? [inv.ewayFileId] : [];
}

function invoiceEditable(inv: InvoiceDetail, requestClosed?: string | null) {
  return !requestClosed && !inv.closedAt;
}

function invoiceDeletable(inv: InvoiceDetail, requestClosed?: string | null) {
  return invoiceEditable(inv, requestClosed) && !inv.mrn && !inv.recycling && !inv.certificates?.length;
}

export function SubmissionDetailPage({ user }: { user: SessionUser }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (user.role === 'client' && sub?.derivedStage === 1 && sub.rejectNote) {
      setStep({ kind: 'edit' });
    }
  }, [user.role, sub?.id, sub?.derivedStage, sub?.rejectNote]);

  useEffect(() => {
    if (!sub || searchParams.get('focus') !== 'serials') return;
    const t = window.setTimeout(() => {
      document.getElementById('serial-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => window.clearTimeout(t);
  }, [sub?.id, searchParams]);

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

  const isStaff = isStaffUser(user);
  const canAck = userCan(user, 'acknowledgeRequest');
  const canReject = userCan(user, 'rejectRequest');
  const canManageVehicles = userCan(user, 'manageVehicles');
  const canManageInvoices = userCan(user, 'manageInvoices');
  const canComplianceAdmin = userCan(user, 'uploadCertificate');
  const stage = sub.derivedStage;
  const phase = viewPhaseForStage(stage);
  const unweighed = sub.vehicles.filter((v) => !v.weighment);
  const netKg = sub.vehicles.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);
  const allWeighed = sub.vehicles.length > 0 && sub.vehicles.every((v) => v.weighment);
  const slipsReady =
    allWeighed &&
    sub.vehicles.every((v) => {
      const w = v.weighment;
      if (!w) return false;
      if (w.manual) return (w.pickupPhotoIds?.length ?? 0) > 0;
      return (w.slipPhotoIds?.length ?? 0) > 0 && (w.pickupPhotoIds?.length ?? 0) > 0;
    });
  const loadingComplete = !!sub.loadingCompletedAt;
  const hasMrn = sub.invoices.some((i) => invoiceHasGoodsReceipt(i));
  const hasCod = sub.invoices.some((i) => i.certificates.length > 0);
  const phase2Locked = !sub.acknowledgedAt;
  const phase3Locked = !loadingComplete;
  const phase4Locked = !hasMrn;
  const phase5Locked = !hasCod;
  const weighTarget =
    step?.kind === 'weigh' ? sub.vehicles.find((v) => v.id === step.vehicleId) : unweighed[0];
  const vehicleTarget =
    step?.kind === 'vehicle' && step.vehicleId
      ? sub.vehicles.find((v) => v.id === step.vehicleId)
      : undefined;
  const invoiceTarget =
    step?.kind === 'invoice' && step.invoiceId
      ? sub.invoices.find((i) => i.id === step.invoiceId)
      : undefined;
  const showResubmit = user.role === 'client' && stage === 1 && !!sub.rejectNote;

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.7rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <h1 className="h1">{sub.id}</h1>
            <StageBadge stage={stage} />
            {sub.rejectNote && stage === 1 ? (
              <span className="badge bg-am">Pending with Requestor</span>
            ) : null}
          </div>
          <div className="p-mu" style={{ margin: '.15rem 0 0' }}>
            {sub.client.name} · {sub.site.name} · {sub.ref || 'no PO'} · raised {fmtDate(sub.requestDate)}
          </div>
        </div>
        <div className="spacer" />
        <Link to="/requests" className="btn bs">
          ← Back
        </Link>
        {showResubmit ? (
          <button type="button" className="btn bp" disabled={busy} onClick={() => setStep({ kind: 'edit' })}>
            ✉️ Respond & resubmit
          </button>
        ) : null}
        {canAck && phase === 1 && stage === 1 ? (
          <button type="button" className="btn bp" disabled={busy} onClick={() => setStep({ kind: 'ack' })}>
            ✅ Acknowledge Request
          </button>
        ) : null}
        {canManageVehicles && phase === 2 && !sub.vehicles.length ? (
          <button type="button" className="btn bp" onClick={() => setStep({ kind: 'vehicle' })}>
            🚚 Assign Vehicle
          </button>
        ) : null}
        {canManageVehicles && phase === 2 && unweighed.length ? (
          <button
            type="button"
            className="btn bp"
            onClick={() => setStep({ kind: 'weigh', vehicleId: unweighed[0].id })}
          >
            ⚖️ Weigh ({unweighed.length} pending)
          </button>
        ) : null}
        {canManageVehicles && phase === 2 && slipsReady && !loadingComplete ? (
          <button
            type="button"
            className="btn bp"
            disabled={busy}
            onClick={() =>
              void act(
                () => lifecycleApi.completeLoading(sub.id),
                'Loading acknowledged — invoicing is now unlocked.',
              )
            }
          >
            ✅ Acknowledge loading complete
          </button>
        ) : null}
        {canManageInvoices && phase === 3 && loadingComplete ? (
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
              {sub.rejectBy ? ` · ${sub.rejectBy}` : ''}
            </div>
          ) : null}
          {user.role === 'client' ? (
            <button
              type="button"
              className="btn bp bsm"
              style={{ marginTop: '.55rem' }}
              disabled={busy}
              onClick={() => setStep({ kind: 'edit' })}
            >
              Respond with updates
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="detail-grid">
        <div>
          <WorkflowSection
            phase={VIEW_PHASES[0]}
            current={phase === 1}
            done={phase > 1}
          >
            <RequestCard
              sub={sub}
              user={user}
              busy={busy}
              onEdit={() => setStep({ kind: 'edit' })}
              onBom={(bomFileIds) =>
                act(
                  () =>
                    lifecycleApi.updateSubmission(sub.id, {
                      bomFileIds,
                      bomFileId: bomFileIds[0] ?? null,
                    }),
                  'Bill of materials updated.',
                )
              }
            />

            {(canAck || canReject) && stage === 1 ? (
              <div className="card">
                <div className="card-ttl">Acknowledge request</div>
                <p className="p-mu">
                  Accepting this request moves it to Vehicles & Weighment and sends an acknowledgement
                  email to the requestor.
                </p>
                {canReject ? (
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => setStep({ kind: 'reject' })}>
                    Request changes
                  </button>
                ) : null}
              </div>
            ) : null}
          </WorkflowSection>

          <WorkflowSection
            phase={VIEW_PHASES[1]}
            current={phase === 2}
            done={phase > 2}
            locked={phase2Locked}
            lockReason="Acknowledge the request before vehicles can be assigned."
          >
            <VehicleCard
              sub={sub}
              user={user}
              netKg={netKg}
              onAddVehicle={() => setStep({ kind: 'vehicle' })}
              onEditVehicle={(vehicleId) => setStep({ kind: 'vehicle', vehicleId })}
              onWeighVehicle={(vehicleId) => setStep({ kind: 'weigh', vehicleId })}
              onDeleteVehicle={(vehicleId, registration) => {
                if (
                  !window.confirm(
                    `Delete vehicle ${registration}? This removes an incorrect assignment and cannot be undone.`,
                  )
                ) {
                  return;
                }
                void act(() => lifecycleApi.deleteVehicle(vehicleId), `Vehicle ${registration} removed.`);
              }}
            />
            {canManageVehicles && slipsReady && !loadingComplete && !sub.closedAt ? (
              <div className="card" style={{ marginTop: '.5rem' }}>
                <div className="card-ttl">Acknowledge loading complete</div>
                <p className="p-mu">
                  All vehicles are weighed with slips/photos uploaded. Confirm loading is finished to unlock
                  invoicing.
                </p>
                <button
                  type="button"
                  className="btn bp"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => lifecycleApi.completeLoading(sub.id),
                      'Loading acknowledged — invoicing is now unlocked.',
                    )
                  }
                >
                  ✅ Acknowledge loading complete
                </button>
              </div>
            ) : null}
            {loadingComplete ? (
              <div className="dim" style={{ fontSize: '.78rem', marginTop: '.35rem' }}>
                Loading acknowledged{sub.loadingCompletedBy ? ` by ${sub.loadingCompletedBy}` : ''}
                {sub.loadingCompletedAt ? ` · ${fmtTS(sub.loadingCompletedAt)}` : ''}
              </div>
            ) : null}
          </WorkflowSection>

          <WorkflowSection
            phase={VIEW_PHASES[2]}
            current={phase === 3}
            done={phase > 3}
            locked={phase3Locked}
            lockReason="Acknowledge loading complete after every vehicle is weighed and weighment slips are uploaded."
          >
            {sub.invoices.length ? (
              <>
                {sub.invoices.length > 1 ? (
                  <div className="tw" style={{ marginBottom: '.5rem' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Billed</th>
                          <th>Payment</th>
                          <th>MRN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.invoices.map((inv) => {
                          const paid = settledPaise(inv.payments);
                          const pay = getPayStatus(BigInt(inv.totalPaise), paid);
                          return (
                            <tr
                              key={inv.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                document.getElementById(`inv-${inv.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                            >
                              <td className="mono">{inv.invoiceNo}</td>
                              <td className="mono">{num(Number(inv.billingWeight))} kg</td>
                              <td>
                                <span className={`badge ${pay.key === 'paid' ? 'bg-g' : pay.key === 'partial' ? 'bg-am' : 'bg-rd'}`}>
                                  {pay.label}
                                </span>
                              </td>
                              <td>
                                {isStaff && inv.mrn ? (
                                  <span className="badge bg-bl">{inv.mrn.mrnNo}</span>
                                ) : invoiceHasGoodsReceipt(inv) ? (
                                  <span className="badge bg-bl">Received</span>
                                ) : (
                                  <span className="badge bg-am">{isStaff ? 'Pending' : 'In transit'}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {sub.invoices.map((inv) => (
                  <InvoiceLifecyclePanel
                    key={`bill-${inv.id}`}
                    section="invoice-mrn"
                    invoice={inv}
                    vehicles={sub.vehicles}
                    lineItems={sub.items ?? []}
                    payTermsDays={sub.client.payTermsDays ?? 30}
                    user={user}
                    disabled={busy || !!sub.closedAt}
                    onAction={act}
                    onEditInvoice={
                      canManageInvoices && invoiceEditable(inv, sub.closedAt)
                        ? () => setStep({ kind: 'invoice', invoiceId: inv.id })
                        : undefined
                    }
                    onDeleteInvoice={
                      canManageInvoices && invoiceEditable(inv, sub.closedAt)
                        ? () => {
                            if (!invoiceDeletable(inv, sub.closedAt)) {
                              setError(
                                'Delete is unavailable after goods receipt (MRN). You can still edit invoice details.',
                              );
                              return;
                            }
                            if (
                              !window.confirm(
                                `Delete invoice ${inv.invoiceNo}? This removes the invoice and any payments recorded against it.`,
                              )
                            ) {
                              return;
                            }
                            void act(() => lifecycleApi.deleteInvoice(inv.id), `Invoice ${inv.invoiceNo} removed.`);
                          }
                        : undefined
                    }
                    canDeleteInvoice={invoiceDeletable(inv, sub.closedAt)}
                  />
                ))}
              </>
            ) : (
              <div className="card">
                <p className="dim" style={{ margin: 0, fontSize: '.85rem' }}>
                  Weighment is complete. Raise an invoice to bill the material and open goods receipt (MRN).
                </p>
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            phase={VIEW_PHASES[3]}
            current={phase === 4}
            done={phase > 4}
            locked={phase4Locked}
            lockReason="Create the MRN for each invoice before Form 6 and the Certificate of Destruction."
          >
            {sub.invoices.map((inv) => (
              <InvoiceLifecyclePanel
                key={`recy-${inv.id}`}
                section="recycling"
                invoice={inv}
                vehicles={sub.vehicles}
                lineItems={sub.items ?? []}
                payTermsDays={sub.client.payTermsDays ?? 30}
                user={user}
                disabled={busy || !!sub.closedAt}
                onAction={act}
              />
            ))}
            <CertificatesCard sub={sub} />
            <ComplianceCard sub={sub} isStaff={isStaff} isAdmin={canComplianceAdmin} onAction={act} />
          </WorkflowSection>

          <WorkflowSection
            phase={VIEW_PHASES[4]}
            current={phase === 5}
            done={!!sub.closedAt}
            locked={phase5Locked}
            lockReason="Upload the Certificate of Destruction before the request can be closed."
          >
            {sub.invoices.map((inv) => (
              <InvoiceLifecyclePanel
                key={`close-${inv.id}`}
                section="close"
                invoice={inv}
                vehicles={sub.vehicles}
                lineItems={sub.items ?? []}
                payTermsDays={sub.client.payTermsDays ?? 30}
                user={user}
                disabled={busy || !!sub.closedAt}
                onAction={act}
              />
            ))}
          </WorkflowSection>
        </div>

        <div>
          <DetailsCard sub={sub} />
          <RequestLifecycleCard events={sub.lifecycleEvents ?? []} />
          <RecyclingSlaSidebar invoices={sub.invoices} />
          <QueryThread
            submissionId={sub.id}
            queries={sub.queries ?? []}
            user={user}
            disabled={busy || !!sub.closedAt}
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
            Accepting this request moves it to <b>Vehicles & Weighment</b> and sends an automatic acknowledgement
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
                <div className="tile-v">
                  {sub.onBehalfOf ? (
                    <>
                      <span>{sub.onBehalfOf}</span>
                      <div style={{ fontSize: '.72rem', color: 'var(--g2)', marginTop: '.1rem' }}>
                        via {sub.createdBy}
                      </div>
                    </>
                  ) : (
                    sub.createdBy
                  )}
                </div>
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
            📧 Email will be sent to <b>{clientEmailRecipient(sub)}</b> using the Request Acknowledgement template.
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
            clientEmail={clientEmailRecipient(sub)}
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
          okLabel={weighTarget.weighment ? 'Save weighment' : 'Record weighment'}
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
          title={
            invoiceTarget
              ? `Edit Invoice — ${invoiceTarget.invoiceNo}`
              : `Raise Invoice — ${sub.id}`
          }
          onClose={() => setStep(null)}
          okLabel={invoiceTarget ? 'Save invoice' : 'Create invoice'}
          form="invoice-form"
          busy={busy}
          wide
        >
          <InvoiceForm
            key={invoiceTarget?.id ?? 'new'}
            formId="invoice-form"
            vehicles={sub.vehicles}
            invoices={sub.invoices}
            invoice={invoiceTarget}
            disabled={busy}
            onSubmit={(body) =>
              invoiceTarget
                ? act(() => lifecycleApi.updateInvoice(invoiceTarget.id, body), 'Invoice updated.')
                : act(() => lifecycleApi.createInvoice(sub.id, body), 'Invoice created.')
            }
          />
        </Modal>
      ) : null}

      {step?.kind === 'edit' ? (
        <Modal
          title={showResubmit ? `Respond & update — ${sub.id}` : `Edit Request — ${sub.id}`}
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
  onBom: (bomFileIds: string[]) => void;
}) {
  const isClient = user.role === 'client';
  const closed = !!sub.closedAt;
  const canEdit = !closed && (userCan(user, 'editRequestAsStaff') || (isClient && sub.derivedStage === 1));
  const showResubmit = isClient && sub.derivedStage === 1 && !!sub.rejectNote;
  const bomIds = bomFilesOf(sub);

  return (
    <CollapsibleCard
      title="📝 Pickup"
      badge={showResubmit ? <span className="badge bg-am">Update in the popup</span> : undefined}
      defaultOpen={sub.derivedStage <= 2}
      summary={`${num(Number(sub.approxWeight))} kg · ${sub.approxQty} units · ${fmtDate(sub.requestDate)}`}
      actions={
        canEdit ? (
          <button type="button" className="btn bs bsm" onClick={onEdit}>
            ✏️ Edit
          </button>
        ) : null
      }
    >
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
          <div className="tile-l">Pick Up Request Date</div>
          <div className="tile-v">{fmtDate(sub.requestDate)}</div>
        </div>
        <div className="tile">
          <div className="tile-l">Raised By</div>
          <div className="tile-v">
            {sub.onBehalfOf ? (
              <>
                <span>{sub.onBehalfOf}</span>
                <div style={{ fontSize: '.72rem', color: 'var(--g2)', marginTop: '.1rem' }}>
                  via {sub.createdBy}
                </div>
              </>
            ) : (
              sub.createdBy
            )}
          </div>
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
      {bomIds.length ? (
        <div className="frow" style={{ flexWrap: 'wrap' }}>
          {bomIds.map((id) => (
            <a
              key={id}
              className="btn bs bsm"
              href={filesApi.url(id)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 400 }}
            >
              📄 View BoM
            </a>
          ))}
        </div>
      ) : (
        <div className="dim" style={{ fontSize: '.8rem', marginBottom: '.4rem' }}>
          No BoM file attached{canEdit ? ' — upload a CSV, Excel or PDF listing line items' : ''}
        </div>
      )}
      {canEdit ? (
        <FileUpload
          kind="bom"
          label={bomIds.length ? 'Add another BoM file' : 'Upload BoM'}
          hint="CSV, Excel or PDF — multiple files allowed"
          accept=".csv,.xls,.xlsx,application/pdf,text/csv"
          disabled={busy}
          value={bomIds}
          onChange={onBom}
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
    </CollapsibleCard>
  );
}

function VehicleCard({
  sub,
  user,
  netKg,
  onAddVehicle,
  onEditVehicle,
  onWeighVehicle,
  onDeleteVehicle,
}: {
  sub: SubmissionDetail;
  user: SessionUser;
  netKg: number;
  onAddVehicle: () => void;
  onEditVehicle: (vehicleId: string) => void;
  onWeighVehicle: (vehicleId: string) => void;
  onDeleteVehicle: (vehicleId: string, registration: string) => void;
}) {
  const canManageVehicles = userCan(user, 'manageVehicles');
  const stage = sub.derivedStage;
  const vehicleTypes = useLookups('vehicleType');
  const logistics = useLookups('logistics');
  const teamRoles = useLookups('teamRole');

  if (!sub.vehicles.length && stage < 3) return null;

  const canAdd = canManageVehicles && stage >= 3 && stage <= 5;
  const canEditVehicle = canManageVehicles && !sub.closedAt;
  const billedVehicleIds = new Set(sub.invoices.flatMap((inv) => inv.vehicleIds ?? []));

  return (
    <CollapsibleCard
      id="assign-vehicle"
      title={`Assigned vehicles (${sub.vehicles.length})`}
      badge={netKg ? <span className="badge bg-g">{num(netKg)} kg net</span> : null}
      defaultOpen={sub.derivedStage >= 3 && sub.derivedStage <= 4}
      summary={
        sub.vehicles.length
          ? sub.vehicles.map((v) => `${v.registration}${v.weighment ? ` ${num(Number(v.weighment.netKg))} kg` : ''}`).join(' · ')
          : 'No vehicles assigned yet'
      }
      actions={
        canAdd ? (
          <button type="button" className="btn bs bsm" onClick={onAddVehicle}>
            + Add Vehicle
          </button>
        ) : null
      }
    >
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
                {canManageVehicles && canEditVehicle && !billedVehicleIds.has(v.id) ? (
                  <button type="button" className="btn brd bsm" onClick={() => onDeleteVehicle(v.id, v.registration)}>
                    Delete
                  </button>
                ) : null}
                {canManageVehicles && !w && stage >= 4 && stage <= 5 ? (
                  <button type="button" className="btn bp bsm" onClick={() => onWeighVehicle(v.id)}>
                    Record Weighment
                  </button>
                ) : null}
                {canManageVehicles && w && stage >= 4 && stage <= 5 ? (
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
    </CollapsibleCard>
  );
}

function DetailsCard({ sub }: { sub: SubmissionDetail }) {
  return (
    <CollapsibleCard title="Details" defaultOpen={sub.derivedStage < 3} summary={`${sub.client.name} · ${sub.site.name}`}>
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
        <div className="tile-l">Pick Up Request Date</div>
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
    </CollapsibleCard>
  );
}

function RecyclingSlaSidebar({ invoices }: { invoices: SubmissionDetail['invoices'] }) {
  const rows = invoices
    .map((inv) => {
      const firstCert = inv.certificates[0]?.certDate ?? inv.certificates[0]?.mailedAt;
      const sla = inv.mrn?.receivedAt
        ? recyclingSla({
            mrnReceivedAt: new Date(inv.mrn.receivedAt),
            certificateAt: firstCert ? new Date(firstCert) : null,
          })
        : null;
      return sla ? { inv, sla } : null;
    })
    .filter((row): row is NonNullable<typeof row> => !!row);
  if (!rows.length) return null;

  return (
    <CollapsibleCard
      title="⏱️ Recycling SLA"
      defaultOpen
      summary={rows.map((r) => `${r.inv.invoiceNo} ${SLA_LABEL[r.sla.state]}`).join(' · ')}
    >
      {rows.map(({ inv, sla }) => {
        const slaColor =
          sla.state === 'met'
            ? 'var(--g)'
            : sla.state === 'warn'
              ? 'var(--am)'
              : sla.state === 'ok'
                ? 'var(--bl)'
                : 'var(--rd)';
        return (
          <div key={inv.id} className="sla-row">
            <div className="inv-split-hd" style={{ marginBottom: '.35rem' }}>
              <b className="mono" style={{ fontSize: '.8rem' }}>
                {inv.invoiceNo}
              </b>
              <span className={`badge ${SLA_CLASS[sla.state]}`}>{SLA_LABEL[sla.state]}</span>
            </div>
            <div className="dim" style={{ fontSize: '.72rem', marginBottom: '.35rem' }}>
              {sla.slaDays}-day target from material receipt
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '.35rem',
                marginBottom: '.35rem',
              }}
            >
              <div className="tile">
                <div className="tile-l">Received</div>
                <div className="tile-v" style={{ fontSize: '.82rem' }}>
                  {fmtDate(sla.start.toISOString())}
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">Target</div>
                <div className="tile-v" style={{ fontSize: '.82rem' }}>
                  {fmtDate(sla.targetDate)}
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">{sla.done ? 'Issued' : 'Elapsed'}</div>
                <div className="tile-v" style={{ fontSize: '.82rem', color: slaColor }}>
                  {sla.done ? fmtDate(sla.endAt?.toISOString()) : `${sla.daysUsed} / ${sla.slaDays}d`}
                </div>
              </div>
              <div className="tile">
                <div className="tile-l">{sla.done ? 'Turnaround' : sla.remaining >= 0 ? 'Remaining' : 'Over'}</div>
                <div className="tile-v" style={{ fontSize: '.82rem', color: slaColor }}>
                  {sla.done ? `${sla.daysUsed}d` : `${Math.abs(sla.remaining)}d`}
                </div>
              </div>
            </div>
            <div className="bar">
              <div className="bar-f" style={{ width: `${Math.min(100, sla.pct * 100)}%`, background: slaColor }} />
              <div className="bar-t">{Math.round(Math.min(100, sla.pct * 100))}%</div>
            </div>
          </div>
        );
      })}
    </CollapsibleCard>
  );
}

function CertificatesCard({ sub }: { sub: SubmissionDetail }) {
  const rows = sub.invoices.flatMap((inv) => inv.certificates.map((c) => ({ inv, c })));
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
                    <a className="btn bp bsm" href={filesApi.url(c.fileId)} target="_blank" rel="noopener noreferrer">
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

function ComplianceCard({
  sub,
  isStaff,
  isAdmin,
  onAction,
}: {
  sub: SubmissionDetail;
  isStaff: boolean;
  isAdmin: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailBusy, setEmailBusy] = useState(false);

  type DocRow = {
    key: string;
    kind: string;
    no: string;
    inv: string;
    invId: string;
    dt: string;
    note: string;
    href?: string;
    internal?: boolean;
    certId?: string;
    emailed?: boolean;
  };

  const docs: DocRow[] = [];
  for (const inv of sub.invoices) {
    if (inv.mrn && isStaff) {
      docs.push({
        key: `mrn:${inv.id}`,
        kind: 'MRN',
        no: inv.mrn.mrnNo,
        inv: inv.invoiceNo,
        invId: inv.id,
        dt: inv.mrn.receivedAt ?? '',
        note: inv.mrn.factory?.name || inv.mrn.factoryId,
        href: filesApi.pdf(`/invoices/${inv.id}/mrn.pdf`),
        internal: true,
      });
    }
    if (inv.recycling && (inv.recycling.reviewStatus === 'approved' || !inv.recycling.reviewStatus)) {
      docs.push({
        key: `form6:${inv.id}`,
        kind: 'Form 6',
        no: inv.recycling.form6No,
        inv: inv.invoiceNo,
        invId: inv.id,
        dt: inv.recycling.processedAt ?? '',
        note: `E-way ${inv.ewayBillNo || '—'}`,
        href: filesApi.pdf(`/invoices/${inv.id}/form6.pdf`),
      });
    }
    for (const c of inv.certificates) {
      docs.push({
        key: `cert:${c.id ?? c.certNo}`,
        kind: 'Certificate',
        no: c.certNo,
        inv: inv.invoiceNo,
        invId: inv.id,
        dt: c.certDate ?? '',
        note: c.department || 'whole invoice',
        href: c.fileId ? filesApi.url(c.fileId) : undefined,
        certId: c.id,
        emailed: !!c.mailedAt,
      });
    }
  }
  if (!docs.length) return null;
  const hasCod = docs.some((d) => d.kind === 'Certificate');
  if (!hasCod) return null;
  const f6n = docs.filter((d) => d.kind === 'Form 6').length;
  const codn = docs.filter((d) => d.kind === 'Certificate').length;
  const emailable = docs.filter((d) => !d.internal);

  function toggle(key: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function downloadAll(kind: 'Form 6' | 'Certificate') {
    docs
      .filter((d) => d.kind === kind && d.href)
      .forEach((d, i) => {
        setTimeout(() => window.open(d.href, '_blank'), i * 350);
      });
  }

  async function sendSelected() {
    const picked = docs.filter((d) => selected.has(d.key));
    if (!picked.length) return;
    setEmailBusy(true);
    try {
      const certificateIds = picked.filter((d) => d.certId).map((d) => d.certId!);
      const form6InvoiceIds = picked.filter((d) => d.kind === 'Form 6').map((d) => d.invId);
      const ok = await onAction(
        () => lifecycleApi.sendComplianceDocuments(sub.id, { certificateIds, form6InvoiceIds }),
        `Emailed ${picked.length} document${picked.length === 1 ? '' : 's'} to the client.`,
      );
      if (ok !== false) setSelected(new Set());
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">📁 Compliance Documents</div>
        <span className="badge bg-gy">{docs.length}</span>
        <div className="spacer" />
        {isAdmin ? (
          <button
            type="button"
            className="btn bp bsm"
            disabled={emailBusy || !selected.size}
            onClick={() => void sendSelected()}
          >
            {emailBusy ? 'Sending…' : '✉ Send by email'}
          </button>
        ) : null}
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
        {isAdmin ? ' Select documents and use Send by email when the client should receive them.' : ''}
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              {isAdmin ? <th></th> : null}
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
              <tr key={dc.key}>
                {isAdmin ? (
                  <td>
                    {dc.internal ? (
                      <span className="dim">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(dc.key)}
                        onChange={() => toggle(dc.key)}
                        aria-label={`Select ${dc.kind} ${dc.no}`}
                      />
                    )}
                  </td>
                ) : null}
                <td>
                  <span className={`badge ${dc.kind === 'Certificate' ? 'bg-g' : dc.kind === 'Form 6' ? 'bg-bl' : 'bg-gy'}`}>
                    {dc.kind}
                  </span>
                  {dc.internal ? <div className="dim" style={{ fontSize: '.68rem' }}>internal</div> : null}
                  {dc.emailed ? (
                    <div className="dim" style={{ fontSize: '.68rem' }}>
                      ✉ sent
                    </div>
                  ) : null}
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
                    <a className="btn bp bsm" href={dc.href} target="_blank" rel="noopener noreferrer">
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
      {isAdmin && emailable.length ? (
        <div className="dim" style={{ fontSize: '.74rem', marginTop: '.45rem' }}>
          MRN is internal only and is not emailed to clients. Form 6 and certificates can be shared from here.
        </div>
      ) : null}
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
    responseNote?: string;
    items?: Array<{ name: string; qty?: number; weightKg?: number; hsn?: string }>;
  }) => void;
}) {
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [siteId, setSiteId] = useState(sub.siteId);
  const originalPickup = sub.requestDate.slice(0, 10);
  const [requestDate, setRequestDate] = useState(originalPickup);
  const [location, setLocation] = useState(sub.location ?? '');
  const [approxQty, setApproxQty] = useState(String(sub.approxQty));
  const [approxWeight, setApproxWeight] = useState(String(sub.approxWeight));
  const [notes, setNotes] = useState(sub.notes ?? '');
  const [ref, setRef] = useState(sub.ref ?? '');
  const [responseNote, setResponseNote] = useState('');
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
          responseNote: resubmit ? responseNote.trim() : undefined,
          items: named,
        });
      }}
    >
      {resubmit && sub.rejectNote ? (
        <div className="card" style={{ background: 'var(--rd2)', borderColor: '#fecaca', marginBottom: '.8rem' }}>
          <div className="card-ttl" style={{ color: 'var(--rd)', fontSize: '.82rem' }}>
            Urbeno requested changes
          </div>
          <div style={{ fontSize: '.84rem', marginTop: '.25rem' }}>{sub.rejectNote}</div>
          {sub.rejectAt ? (
            <div className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
              {fmtTS(sub.rejectAt)}
              {sub.rejectBy ? ` · ${sub.rejectBy}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.8rem' }}>
        {resubmit
          ? 'Update the request details below, explain what you changed, then resubmit to Urbeno.'
          : 'Admin edit — all changes are audit-logged.'}
      </p>
      {resubmit ? (
        <div className="fg" style={{ marginBottom: '.8rem' }}>
          <label htmlFor="er-response">Your response to Urbeno</label>
          <textarea
            id="er-response"
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
            required
            rows={3}
            placeholder="Explain the updates you made (e.g. revised pickup location, attached BoM, corrected quantities)."
          />
        </div>
      ) : null}
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
        <DateField
          id="er-date"
          label="Pick Up Request Date"
          value={requestDate}
          min={originalPickup < todayIso() ? originalPickup : todayIso()}
          onChange={setRequestDate}
          required
        />
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
  clientEmail,
}: {
  disabled: boolean;
  formId?: string;
  clientEmail?: string;
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
      {clientEmail ? (
        <div
          style={{
            background: 'var(--bl2)',
            padding: '.55rem .8rem',
            borderRadius: 8,
            fontSize: '.78rem',
            color: 'var(--bl)',
            marginBottom: '.7rem',
          }}
        >
          📧 Email will be sent to <b>{clientEmail}</b> using the Changes Requested template.
        </div>
      ) : null}
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
  const [registration, setRegistration] = useState(
    (vehicle?.registration ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  );
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? 'VT2');
  const [driverName, setDriverName] = useState(vehicle?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(vehicle?.driverPhone ?? '');
  const [partner, setPartner] = useState(vehicle?.logisticsPartner ?? '');
  const [expectedAt, setExpectedAt] = useState(
    vehicle?.expectedAt ? vehicle.expectedAt : defaultDateTimeValue(),
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
          setError('Select expected pickup date and time.');
          return;
        }
        if (!/^[A-Z0-9]+$/.test(registration)) {
          setError('Vehicle registration can only contain letters and numbers — no spaces or special characters.');
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
          (registration !== vehicle.registration.toUpperCase().replace(/[^A-Z0-9]/g, '') ||
            vehicleType !== vehicle.vehicleType);
        if (identityChanged && !remark.trim()) {
          setError(
            'Record a remark when changing the vehicle number or type (for example a breakdown or replacement).',
          );
          return;
        }
        const expectedPickup = expectedAt;
        onAssign({
          registration,
          vehicleType,
          driverName,
          driverPhone,
          logisticsPartner: partner || undefined,
          expectedAt: expectedPickup || undefined,
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
            onChange={(e) => setRegistration(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            required
            placeholder="KA01AB1234"
            autoComplete="off"
            inputMode="text"
            style={{ fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}
          />
          <p className="hint" style={{ textAlign: 'left' }}>Letters and numbers only — no spaces or special characters</p>
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
        <DateTimeField
          id="vh-exp"
          label="Expected pickup date & time"
          value={expectedAt}
          minDate={localDateIso()}
          onChange={setExpectedAt}
          required
          hint="Choose a date, set the time (or tap a quick slot). No separate confirm step needed."
        />
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
              <option value="">Select role</option>
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
        onClick={() => setTeam((rows) => [...rows, { name: '', role: '', phone: '' }])}
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
  vehicle: VehicleDetail;
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
  const existing = vehicle.weighment;
  const [manual, setManual] = useState(Boolean(existing?.manual));
  const [gross, setGross] = useState(existing?.grossKg ? String(existing.grossKg) : '');
  const [tare, setTare] = useState(existing?.tareKg ? String(existing.tareKg) : '');
  const [manualNet, setManualNet] = useState(existing?.manual ? String(existing?.netKg ?? '') : '');
  const [slip, setSlip] = useState(existing?.slipNumber ?? '');
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [slipPhotos, setSlipPhotos] = useState<string[]>(existing?.slipPhotoIds ?? []);
  const [pickupPhotos, setPickupPhotos] = useState<string[]>(existing?.pickupPhotoIds ?? []);
  const [formError, setFormError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const grossNum = parseFloat(gross) || 0;
  const tareNum = parseFloat(tare) || 0;
  const hasWeights = gross.trim() !== '' && tare.trim() !== '';
  const netKg = hasWeights ? grossNum - tareNum : null;
  const netInvalid = netKg !== null && !(netKg > 0);

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
          const recorded = Number(manualNet);
          if (!(recorded > 0)) {
            const msg = 'Net weight cannot be zero or negative. Enter a positive recorded weight.';
            setFormError(msg);
            window.alert(msg);
            return;
          }
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
          if (netInvalid || netKg === null) {
            const msg = 'Net weight cannot be zero or negative. Check gross and tare, then try again.';
            setFormError(msg);
            window.alert(msg);
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
          <div className="fg">
            <label>Weighment Slip # *</label>
            <input value={slip} onChange={(e) => setSlip(e.target.value)} required placeholder="WS-0042" style={{ fontFamily: 'ui-monospace, monospace' }} />
          </div>
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
                style={{ fontWeight: 700, color: netInvalid ? 'var(--rd)' : netKg !== null ? 'var(--g)' : 'var(--g2)' }}
              />
            </div>
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
        hint="At least 1 photo · max 5 MB each · JPG, PNG, WEBP, HEIC"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        disabled={disabled}
        value={pickupPhotos}
        onChange={setPickupPhotos}
      />
      {formError ? <p className="error">{formError}</p> : null}
      {formId ? null : (
        <button
          type="submit"
          className="btn primary"
          disabled={disabled || !pickupPhotos.length || (!manual && (!slipPhotos.length || netInvalid))}
        >
          {existing ? 'Save weighment' : 'Record weighment'}
        </button>
      )}
    </form>
  );
}

type InvoiceFormBody = {
  invoiceNo: string;
  invoiceDate: string;
  taxableAmount: number;
  ewayBillNo: string;
  ewayBillDate: string;
  vehicleIds: string[];
  taxRatePct: number;
  billingWeight: number;
  billingMode?: string;
  invoiceFileId?: string;
  ewayFileId?: string;
  invoiceFileIds?: string[];
  ewayFileIds?: string[];
};

function InvoiceForm({
  vehicles,
  invoices,
  invoice,
  disabled,
  onSubmit,
  formId,
}: {
  vehicles: Array<{ id: string; registration: string; weighment: { netKg: string } | null }>;
  invoices: Array<{ id: string; billingWeight: string }>;
  invoice?: InvoiceDetail;
  disabled: boolean;
  formId?: string;
  onSubmit: (body: InvoiceFormBody) => void;
}) {
  const today = localDateIso();
  const taxRates = useLookups('taxRate');
  const [invoiceNo, setInvoiceNo] = useState(invoice?.invoiceNo ?? '');
  const [invoiceDate, setInvoiceDate] = useState(splitDateTime(invoice?.invoiceDate).date);
  const [taxableAmount, setTaxableAmount] = useState(
    invoice?.taxablePaise != null ? String(paiseToRupees(Number(invoice.taxablePaise))) : '',
  );
  const [taxRateId, setTaxRateId] = useState('');
  const [billingMode, setBillingMode] = useState<'urbeno' | 'client'>(
    invoice?.billingMode === 'client' ? 'client' : 'urbeno',
  );
  const [eway, setEway] = useState(invoice?.ewayBillNo ?? '');
  const [ewayDate, setEwayDate] = useState(splitDateTime(invoice?.ewayBillDate).date);
  const [vehIds, setVehIds] = useState<string[]>(() =>
    invoice?.vehicleIds?.length ? invoice.vehicleIds : vehicles.map((v) => v.id),
  );
  const [billingWeight, setBillingWeight] = useState(
    invoice?.billingWeight != null && invoice.billingWeight !== '' ? String(Number(invoice.billingWeight)) : '',
  );
  const [invoiceFileIds, setInvoiceFileIds] = useState<string[]>(() => invoicePdfIds(invoice));
  const [ewayFileIdList, setEwayFileIdList] = useState<string[]>(() => ewayPdfIds(invoice));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoice || !taxRates.length) return;
    setTaxRateId((current) => {
      if (current && taxRates.some((t) => t.id === current)) return current;
      const match = taxRates.find((t) => Number(t.rate) === Number(invoice.taxRatePct));
      return match?.id ?? current;
    });
  }, [invoice, taxRates]);

  const selectedRate = taxRates.find((t) => t.id === taxRateId);
  const taxPct = selectedRate ? Number(selectedRate.rate) : Number.NaN;
  const taxable = Number(taxableAmount);
  const taxValue = Number.isFinite(taxPct) && Number.isFinite(taxable) ? +(taxable * taxPct) / 100 : 0;
  const totalValue = (Number.isFinite(taxable) ? taxable : 0) + taxValue;
  const totalNet = vehicles.reduce((s, v) => s + Number(v.weighment?.netKg ?? 0), 0);
  const alreadyBilled = invoices
    .filter((inv) => inv.id !== invoice?.id)
    .reduce((s, inv) => s + Number(inv.billingWeight ?? 0), 0);
  const remaining = Math.round((totalNet - alreadyBilled) * 1000) / 1000;
  const billWt = Number(billingWeight) || 0;
  const remainingAfter = Math.round((remaining - billWt) * 1000) / 1000;

  function toggleVeh(id: string) {
    setVehIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!invoiceNo.trim()) {
          setError('Invoice number is required.');
          return;
        }
        if (!invoiceDate) {
          setError('Invoice date is required.');
          return;
        }
        if (invoiceDate > today) {
          setError('Invoice date cannot be a future date.');
          return;
        }
        if (!taxableAmount || Number.isNaN(taxable) || taxable < 0) {
          setError('Taxable amount is required.');
          return;
        }
        if (!taxRateId || !Number.isFinite(taxPct)) {
          const fallbackPct = Number(invoice?.taxRatePct);
          if (!Number.isFinite(fallbackPct)) {
            setError('Select a tax rate.');
            return;
          }
        }
        const resolvedTaxPct = Number.isFinite(taxPct) ? taxPct : Number(invoice?.taxRatePct);
        if (!eway.trim()) {
          setError('E-way bill number is required.');
          return;
        }
        if (!ewayDate) {
          setError('E-way bill date is required.');
          return;
        }
        if (ewayDate > today) {
          setError('E-way bill date cannot be a future date.');
          return;
        }
        if (!billingWeight || !(billWt > 0)) {
          setError('Billing weight is required.');
          return;
        }
        if (billWt - remaining > 0.001) {
          setError(
            `Billing weight (${billWt} kg) exceeds the remaining weighment (${remaining} kg). Total vehicle weighment is ${totalNet} kg.`,
          );
          return;
        }
        if (!vehIds.length) {
          setError('Select at least one vehicle covered by this invoice.');
          return;
        }
        onSubmit({
          invoiceNo: invoiceNo.trim(),
          invoiceDate,
          taxableAmount: taxable,
          ewayBillNo: eway.trim(),
          ewayBillDate: ewayDate,
          vehicleIds: vehIds,
          taxRatePct: resolvedTaxPct,
          billingWeight: billWt,
          billingMode,
          invoiceFileId: invoiceFileIds[0],
          ewayFileId: ewayFileIdList[0],
          invoiceFileIds,
          ewayFileIds: ewayFileIdList,
        });
      }}
    >
      <h3>{invoice ? 'Edit invoice' : 'Raise invoice'}</h3>
      <p className="dim" style={{ fontSize: '.82rem', margin: '-.3rem 0 .7rem' }}>
        Each invoice needs its own e-way bill and progresses independently through MRN, recycling, certificate and
        closure. Billing weights across all invoices must equal the total weighment of all vehicles.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="fg">
        <label htmlFor="iv-mode">Invoice mode</label>
        <select id="iv-mode" value={billingMode} onChange={(e) => setBillingMode(e.target.value as 'urbeno' | 'client')}>
          <option value="urbeno">Urbeno raises invoice (Urbeno → Client)</option>
          <option value="client">Client raises invoice (Client → Urbeno)</option>
        </select>
      </div>
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
        <DateField
          id="iv-dt"
          label="Invoice date"
          value={invoiceDate}
          max={today}
          onChange={setInvoiceDate}
          required
        />
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
          <select id="iv-tax" value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)} required={!invoice}>
            <option value="">Select tax rate</option>
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="iv-gst">Tax value (₹)</label>
          <input
            id="iv-gst"
            value={Number.isFinite(taxPct) && taxableAmount ? formatINR(rupeesToPaise(taxValue)) : ''}
            disabled
            placeholder="—"
            style={{ fontWeight: 700, color: 'var(--g2)' }}
          />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="iv-tot">Total invoice value (₹)</label>
        <input
          id="iv-tot"
          value={Number.isFinite(taxPct) && taxableAmount ? formatINR(rupeesToPaise(totalValue)) : ''}
          disabled
          placeholder="—"
          style={{ fontWeight: 800, color: 'var(--g2)', fontSize: '1rem' }}
        />
      </div>
      {Number.isFinite(taxPct) && taxableAmount ? (
        <div className="dim" style={{ fontSize: '.74rem', margin: '-.3rem 0 .6rem' }}>
          {formatINR(rupeesToPaise(taxable))} taxable + {formatINR(rupeesToPaise(taxValue))} at {taxPct}% ={' '}
          {formatINR(rupeesToPaise(totalValue))}
          {selectedRate?.description ? ` · ${selectedRate.description}` : ''}
        </div>
      ) : (
        <div className="dim" style={{ fontSize: '.74rem', margin: '-.3rem 0 .6rem' }}>
          Enter taxable amount and select a tax rate to calculate tax.
        </div>
      )}
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
        <DateField
          id="iv-ewdt"
          label="E-way bill date"
          value={ewayDate}
          max={today}
          onChange={setEwayDate}
          required
        />
      </div>
      <div className="fr2">
        <div className="fg">
          <label htmlFor="iv-wt">Billing weight (kg)</label>
          <input
            id="iv-wt"
            type="number"
            step="0.001"
            min="0"
            value={billingWeight}
            onChange={(e) => setBillingWeight(e.target.value)}
            required
            placeholder="Enter billed kg"
          />
          <div className="dim" style={{ fontSize: '.74rem', marginTop: '.2rem' }}>
            {billWt - remaining > 0.001 ? (
              <span style={{ color: 'var(--am)' }}>
                Exceeds remaining weighment by {Math.round((billWt - remaining) * 1000) / 1000} kg
              </span>
            ) : remainingAfter > 0.001 ? (
              <span>
                Remaining after this invoice: {remainingAfter} kg — add another invoice so the total matches weighment
              </span>
            ) : (
              <span style={{ color: 'var(--g)' }}>✓ Matches remaining weighment</span>
            )}
          </div>
        </div>
        <div className="fg">
          <label htmlFor="iv-vnet">Total weighment (all vehicles)</label>
          <input
            id="iv-vnet"
            value={totalNet ? totalNet.toFixed(3) : '—'}
            disabled
            style={{ fontWeight: 700, color: 'var(--g2)' }}
          />
          <div className="dim" style={{ fontSize: '.74rem', marginTop: '.2rem' }}>
            Already billed {alreadyBilled.toFixed(3)} kg · remaining {remaining.toFixed(3)} kg
          </div>
        </div>
      </div>
      <div className="fg">
        <label>Vehicles covered by this invoice *</label>
        <p className="hint" style={{ textAlign: 'left', margin: '0 0 .3rem' }}>
          Vehicle selection does not change billing weight. Weight is checked against the total weighment of all
          vehicles.
        </p>
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
          hint="You can attach more than one PDF"
          accept="application/pdf"
          disabled={disabled}
          value={invoiceFileIds}
          onChange={setInvoiceFileIds}
        />
        <FileUpload
          kind="eway"
          label="E-way bill PDF"
          hint="You can attach more than one PDF"
          accept="application/pdf"
          disabled={disabled}
          value={ewayFileIdList}
          onChange={setEwayFileIdList}
        />
      </div>
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          {invoice ? 'Save invoice' : 'Create invoice'}
        </button>
      )}
    </form>
  );
}
