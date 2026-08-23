import { useState } from 'react';
import {
  formatINR,
  getPayStatus,
  invoiceDue,
  paymentTermsLabel,
  settledPaise,
  type PayStatusKey,
} from '@urb-tectrack/shared';
import {
  filesApi,
  lifecycleApi,
  type InvoiceDetail,
  type SessionUser,
  type VehicleDetail,
} from '../api';
import { FileUpload } from './FileUpload';
import { FileRow, FileThumb } from './FileThumb';
import { Modal } from './Modal';
import { MrnForm } from './MrnForm';
import { RecyclingForm } from './RecyclingForm';
import { CollapsibleCard } from './CollapsibleCard';
import { DateField } from './DateField';
import { lookupLabel, useLookups } from '../hooks/useLookups';
import { fmtDate, num } from '../lib/format';
import { isStaffUser, userCan } from '../lib/permissions';

/** Goods receipt exists — use hasMrn for clients (MRN payload is R4-redacted). */
export function invoiceHasGoodsReceipt(invoice: Pick<InvoiceDetail, 'mrn' | 'hasMrn' | 'recycling' | 'certificates' | 'closedAt'>): boolean {
  return !!(invoice.hasMrn || invoice.mrn || invoice.recycling || invoice.certificates?.length || invoice.closedAt);
}

export type InvoicePanelSection = 'invoice-mrn' | 'recycling' | 'close';

interface InvoiceLifecyclePanelProps {
  invoice: InvoiceDetail;
  vehicles: VehicleDetail[];
  lineItems?: Array<{ name: string; qty: number; weightKg: string | number }>;
  payTermsDays: number;
  user: SessionUser;
  disabled: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
  onEditInvoice?: () => void;
  onDeleteInvoice?: () => void;
  canDeleteInvoice?: boolean;
  section?: InvoicePanelSection;
}

function payCls(key: PayStatusKey): string {
  if (key === 'paid') return 'bg-g';
  if (key === 'partial') return 'bg-am';
  return 'bg-rd';
}

function asPaise(v: string | number | bigint | undefined): bigint {
  if (v === undefined || v === null) return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

export function InvoiceLifecyclePanel({
  invoice,
  vehicles,
  lineItems = [],
  payTermsDays,
  user,
  disabled,
  onAction,
  onEditInvoice,
  onDeleteInvoice,
  canDeleteInvoice = true,
  section = 'invoice-mrn',
}: InvoiceLifecyclePanelProps) {
  const isStaff = isStaffUser(user);
  const isAdmin = user.role === 'admin';
  const perms = {
    createMrn: userCan(user, 'createMrn'),
    editMrn: userCan(user, 'editMrn'),
    manageRecycling: userCan(user, 'manageRecycling'),
    manageInvoices: userCan(user, 'manageInvoices'),
    uploadCertificate: userCan(user, 'uploadCertificate'),
  };
  const isClient = user.role === 'client';
  const paymentModes = useLookups('paymentMode');
  const taxRates = useLookups('taxRate');
  const [panel, setPanel] = useState<'pay' | 'pay-edit' | 'mrn' | 'recy' | 'cod' | 'close' | null>(null);
  const [editingPayment, setEditingPayment] = useState<typeof invoice.payments[0] | null>(null);

  async function run(fn: () => Promise<unknown>, success: string) {
    const ok = await onAction(fn, success);
    if (ok !== false) setPanel(null);
  }

  const paidPaise = settledPaise(invoice.payments);
  const totalPaise = asPaise(invoice.totalPaise);
  const taxablePaise = asPaise(invoice.taxablePaise);
  const taxPaise = asPaise(invoice.taxPaise);
  const pay = getPayStatus(totalPaise, paidPaise);
  const isPaid = pay.key === 'paid';
  const due = invoice.invoiceDate
    ? invoiceDue(new Date(invoice.invoiceDate), payTermsDays)
    : null;
  const taxPct = Number(invoice.taxRatePct ?? 18);
  const covered =
    invoice.vehicleIds?.length
      ? vehicles.filter((v) => invoice.vehicleIds!.includes(v.id))
      : vehicles;
  const billingKg = Number(invoice.billingWeight || 0);
  const vehicleNet = Number(invoice.vehicleNetKg ?? 0);
  const hasGoodsReceipt = invoiceHasGoodsReceipt(invoice);
  const canCreateMrn = perms.createMrn && !invoice.mrn && !invoice.closedAt;
  const canCreateForm6 = perms.manageRecycling && !!invoice.mrn && !invoice.recycling && !invoice.closedAt;
  const canEditForm6 = perms.manageRecycling && !!invoice.recycling && !invoice.closedAt;
  const canUploadCod = perms.uploadCertificate && !!invoice.recycling && !invoice.closedAt;
  const panelId =
    section === 'recycling' ? `inv-${invoice.id}-recy` : section === 'close' ? `inv-${invoice.id}-close` : `inv-${invoice.id}`;

  return (
    <div className="inv-panel" id={panelId} style={{ padding: section === 'invoice-mrn' ? '.35rem 0 0' : '.2rem 0 0' }}>
      {section === 'invoice-mrn' ? (
      <CollapsibleCard
        title={`Invoice ${invoice.invoiceNo}`}
        badge={
          <>
            <span className={`badge ${payCls(pay.key)}`}>{pay.label}</span>
            {isStaff ? (
              invoice.mrn ? (
                <span className="badge bg-bl">MRN</span>
              ) : (
                <span className="badge bg-am">MRN pending</span>
              )
            ) : hasGoodsReceipt ? (
              <span className="badge bg-bl">Received</span>
            ) : (
              <span className="badge bg-am">In transit</span>
            )}
          </>
        }
        defaultOpen={!hasGoodsReceipt || !isPaid}
        style={{ marginBottom: '.6rem' }}
        summary={
          <span>
            {fmtDate(invoice.invoiceDate)} · {num(billingKg)} kg billed
            {isStaff
              ? invoice.mrn
                ? ` · ${invoice.mrn.mrnNo}`
                : ' · awaiting goods receipt'
              : hasGoodsReceipt
                ? ' · received at facility'
                : ' · awaiting facility receipt'}
          </span>
        }
        actions={
          <>
            {onEditInvoice ? (
              <button type="button" className="btn bs bsm" disabled={disabled} onClick={onEditInvoice}>
                Edit
              </button>
            ) : null}
            {onDeleteInvoice ? (
              <button
                type="button"
                className="btn brd bsm"
                disabled={disabled || !canDeleteInvoice}
                title={
                  canDeleteInvoice
                    ? 'Delete this invoice'
                    : 'Delete is unavailable after goods receipt (MRN). Edit is still available.'
                }
                onClick={onDeleteInvoice}
              >
                Delete
              </button>
            ) : null}
          </>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))',
            gap: '.45rem',
            marginBottom: '.5rem',
          }}
        >
          <div className="tile">
            <div className="tile-l">Invoice Date</div>
            <div className="tile-v">{fmtDate(invoice.invoiceDate)}</div>
          </div>
          <div className="tile">
            <div className="tile-l">Taxable Value</div>
            <div className="tile-v">{formatINR(Number(taxablePaise))}</div>
          </div>
          <div className="tile">
            <div className="tile-l">Tax {taxPct ? `@ ${taxPct}%` : ''}</div>
            <div className="tile-v">{formatINR(Number(taxPaise))}</div>
            <div className="dim" style={{ fontSize: '.68rem' }}>
              {lookupLabel(taxRates, String(taxPct), 'GST 18%')}
            </div>
          </div>
          <div className="tile">
            <div className="tile-l">Total Invoice Value</div>
            <div className="tile-v" style={{ color: 'var(--g2)', fontWeight: 700 }}>
              {formatINR(Number(totalPaise))}
            </div>
          </div>
          <div className="tile">
            <div className="tile-l">Billing Weight</div>
            <div className="tile-v mono">{num(billingKg)} kg</div>
            {Math.abs(Number(invoice.deviationKg ?? 0)) < 0.001 ? (
              <div className="dim" style={{ fontSize: '.68rem' }}>
                remaining weighment billed
              </div>
            ) : (
              <div className="dim" style={{ fontSize: '.68rem' }}>
                of {num(vehicleNet || billingKg)} kg total weighment
              </div>
            )}
          </div>
          <div className="tile">
            <div className="tile-l">Billing direction</div>
            <div className="tile-v">
              {invoice.billingMode === 'client' ? 'Client → Urbeno' : 'Urbeno → Client'}
            </div>
          </div>
        </div>
        {invoice.deviationNote ? (
          <div
            style={{
              background: 'var(--am2)',
              border: '1px solid #fcd34d',
              borderRadius: 8,
              padding: '.45rem .7rem',
              fontSize: '.79rem',
              color: 'var(--g2)',
              marginBottom: '.5rem',
            }}
          >
            <b style={{ color: 'var(--am)' }}>Weight deviation:</b> {invoice.deviationNote}
          </div>
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: '.45rem',
            marginBottom: '.5rem',
          }}
        >
          <div className="tile">
            <div className="tile-l">E-way Bill</div>
            <div className="tile-v mono">{invoice.ewayBillNo || '—'}</div>
            <div className="dim" style={{ fontSize: '.7rem' }}>
              {invoice.ewayBillDate ? fmtDate(invoice.ewayBillDate) : ''}
            </div>
          </div>
          <div className="tile">
            <div className="tile-l">Vehicles Covered</div>
            <div className="tile-v mono" style={{ fontSize: '.78rem' }}>
              {covered.map((v) => v.registration).join(', ') || '—'}
            </div>
          </div>
          <div className="tile">
            <div className="tile-l">Invoice Weight</div>
            <div className="tile-v mono">{num(vehicleNet || billingKg)} kg</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
              Invoice PDF
            </div>
            <div className="frow">
              {(invoice.invoiceFileIds?.length ? invoice.invoiceFileIds : invoice.invoiceFileId ? [invoice.invoiceFileId] : []).length ? (
                (invoice.invoiceFileIds?.length ? invoice.invoiceFileIds : [invoice.invoiceFileId!]).map((id, i) => (
                  <FileThumb key={id} id={id} kind="doc" name={i === 0 ? 'Invoice' : `Invoice ${i + 1}`} />
                ))
              ) : (
                <span className="dim" style={{ fontSize: '.75rem' }}>
                  not attached
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
              E-way Bill PDF
            </div>
            <div className="frow">
              {(invoice.ewayFileIds?.length ? invoice.ewayFileIds : invoice.ewayFileId ? [invoice.ewayFileId] : []).length ? (
                (invoice.ewayFileIds?.length ? invoice.ewayFileIds : [invoice.ewayFileId!]).map((id, i) => (
                  <FileThumb key={id} id={id} kind="doc" name={i === 0 ? 'E-way' : `E-way ${i + 1}`} />
                ))
              ) : (
                <span className="dim" style={{ fontSize: '.75rem' }}>
                  not attached
                </span>
              )}
            </div>
          </div>
        </div>
        {isStaff ? (
          <MrnCard
            embedded
            invoice={invoice}
            vehicles={covered}
            canCreate={canCreateMrn}
            canEdit={perms.editMrn && !!invoice.mrn && !invoice.closedAt}
            onCreateClick={() => setPanel('mrn')}
            onEditClick={() => setPanel('mrn')}
          />
        ) : null}
        <div className="inv-split">
          <div className="inv-split-hd">
            <div className="inv-split-ttl">Payment</div>
            <span className={`badge ${payCls(pay.key)}`}>
              {formatINR(Number(paidPaise))} of {formatINR(Number(totalPaise))}
            </span>
            {pay.key !== 'paid' && due ? (
              due.isOverdue ? (
                <span className="badge bg-rd">overdue {due.overdue}d</span>
              ) : (
                <span className="badge bg-gy">due {fmtDate(due.dueDate)}</span>
              )
            ) : null}
            <div className="spacer" />
            {perms.manageInvoices && !invoice.closedAt ? (
              <button type="button" className="btn bs bsm" onClick={() => setPanel('pay')}>
                + Record Payment
              </button>
            ) : null}
          </div>
          <div className="dim" style={{ fontSize: '.75rem', marginBottom: invoice.payments.length ? '.4rem' : 0 }}>
            {paymentTermsLabel(payTermsDays)}
            {due ? ` · due ${fmtDate(due.dueDate)}` : ''}
            {' · payment stays open on client terms and does not block Form 6 or the certificate'}
          </div>
          {invoice.payments.length ? (
            <div className="tw">
              <table>
                <thead>
                <tr>
                  <th>UTR / Ref</th>
                  <th>Amount</th>
                  <th>TDS</th>
                  <th>Date</th>
                  <th>Mode</th>
                  {perms.manageInvoices && !invoice.closedAt ? <th></th> : null}
                </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p, i) => (
                    <tr key={p.id ?? `${p.utr}-${i}`}>
                      <td className="mono">{p.utr || '—'}</td>
                      <td className="mono">{formatINR(Number(asPaise(p.amountPaise)))}</td>
                      <td className="mono">{Number(asPaise(p.tdsPaise)) ? formatINR(Number(asPaise(p.tdsPaise))) : '—'}</td>
                      <td className="dim">{fmtDate(p.paidAt)}</td>
                      <td>{lookupLabel(paymentModes, p.mode)}</td>
                      {perms.manageInvoices && !invoice.closedAt ? (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn bs bsm"
                            style={{ marginRight: '.25rem' }}
                            onClick={() => { setEditingPayment(p); setPanel('pay-edit'); }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn bd bsm"
                            onClick={() => void run(
                              () => lifecycleApi.deletePayment(p.id!),
                              'Payment deleted.',
                            )}
                          >
                            Delete
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </CollapsibleCard>
      ) : null}

      {section === 'recycling' ? (
        !hasGoodsReceipt ? (
          <div className="card" style={{ marginBottom: '.6rem' }}>
            <div className="card-ttl">Invoice {invoice.invoiceNo}</div>
            <p className="dim" style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
              {isStaff
                ? 'Record the MRN for this invoice before Form 6 can be issued.'
                : 'Recycling and certificates appear after the material is received at the facility.'}
            </p>
          </div>
        ) : (
          <>
            <RecyclingCard
              invoice={invoice}
              canCreate={canCreateForm6}
              canEdit={canEditForm6}
              isStaff={isStaff}
              onCreateClick={() => setPanel('recy')}
              onEditClick={() => setPanel('recy')}
            />
            {invoice.recycling ? (
              <div className="card" style={{ marginBottom: '.6rem' }}>
                <div className="card-hd">
                  <div className="card-ttl">🏅 Certificate of Destruction</div>
                  <div className="spacer" />
                  {canUploadCod ? (
                    <button type="button" className="btn bp bsm" onClick={() => setPanel('cod')}>
                      Upload Certificate
                    </button>
                  ) : null}
                </div>
                {invoice.certificates.length ? (
                  <div className="tw">
                    <table>
                      <thead>
                        <tr>
                          <th>Certificate</th>
                          <th>Department / Scope</th>
                          <th>Issued</th>
                          <th>Emailed</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.certificates.map((c) => (
                          <tr key={c.id ?? c.certNo}>
                            <td className="mono">
                              <b>{c.certNo}</b>
                              {c.note ? (
                                <div className="dim" style={{ fontSize: '.7rem' }}>
                                  {c.note}
                                </div>
                              ) : null}
                            </td>
                            <td>{c.department || <span className="dim">whole invoice</span>}</td>
                            <td className="dim">{fmtDate(c.certDate)}</td>
                            <td>{c.mailedAt ? <span className="badge bg-g">sent</span> : '—'}</td>
                            <td>
                              {c.fileId ? (
                                <a
                                  className="btn bp bsm"
                                  href={filesApi.url(c.fileId)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
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
                ) : (
                  <div className="dim" style={{ fontSize: '.83rem' }}>
                    Form 6 {invoice.recycling.form6No} is on file. Upload the signed certificate PDF when ready.
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ marginBottom: '.6rem' }}>
                <div className="card-ttl">🏅 Certificate of Destruction</div>
                <p className="dim" style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
                  Issue Form 6 first. The Certificate of Destruction is not available until Form 6 is generated.
                </p>
              </div>
            )}
            {invoice.recycling ? (
              <SerialPanel
                invoice={invoice}
                disabled={disabled || !!invoice.closedAt}
                readOnly={!isStaff}
                onAction={onAction}
              />
            ) : null}
          </>
        )
      ) : null}

      {section === 'close' ? (
        invoice.closedAt ? (
          <p className="ok-msg sm">Closed {invoice.closedAt.slice(0, 10)}</p>
        ) : !invoice.certificates.length ? (
          <div className="card" style={{ marginBottom: '.6rem' }}>
            <div className="card-ttl">Invoice {invoice.invoiceNo}</div>
            <p className="dim" style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
              Upload the Certificate of Destruction before this invoice can be closed.
            </p>
          </div>
        ) : (isClient || isAdmin) && isPaid ? (
          <div className="card" style={{ marginBottom: '.6rem' }}>
            <div className="card-hd">
              <div className="card-ttl">🎉 Review & Close — {invoice.invoiceNo}</div>
              <div className="spacer" />
              {isAdmin ? (
                <span title="Review & Close is a client action — the client must acknowledge receipt.">
                  <button type="button" className="btn bs bsm" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                    Review & Close
                  </button>
                </span>
              ) : (
                <button type="button" className="btn bp bsm" onClick={() => setPanel('close')}>
                  Review & Close
                </button>
              )}
            </div>
            <div className="dim" style={{ fontSize: '.83rem', marginBottom: '.45rem' }}>
              {isAdmin
                ? 'This invoice is ready to close. The client must sign off via their portal.'
                : 'Confirm you have received the Certificate of Destruction, then acknowledge closure.'}
            </div>
            {invoice.certificates.some((c) => c.fileId) ? (
              <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                {invoice.certificates
                  .filter((c) => c.fileId)
                  .map((c) => (
                    <a
                      key={c.id ?? c.certNo}
                      className="btn bs bsm"
                      href={filesApi.url(c.fileId!)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ⬇ {c.certNo}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card" style={{ marginBottom: '.6rem' }}>
            <div className="card-ttl">Invoice {invoice.invoiceNo}</div>
            <p className="dim" style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
              The certificate is on file. Closure waits until this invoice is paid — payment can be recorded
              any time under the client’s terms and does not block earlier steps.
            </p>
            {invoice.certificates.some((c) => c.fileId) ? (
              <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.45rem' }}>
                {invoice.certificates
                  .filter((c) => c.fileId)
                  .map((c) => (
                    <a
                      key={c.id ?? c.certNo}
                      className="btn bs bsm"
                      href={filesApi.url(c.fileId!)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ⬇ Download {c.certNo}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {panel === 'pay' ? (
        <Modal
          title={`Record Payment — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Record payment"
          form="pay-form"
          busy={disabled}
        >
          <PaymentForm
            formId="pay-form"
            amountDue={Number(totalPaise - paidPaise) / 100}
            invoiceTotal={Number(totalPaise) / 100}
            disabled={disabled}
            onSubmit={(body) => run(() => lifecycleApi.addPayment(invoice.id, body), 'Payment recorded.')}
          />
        </Modal>
      ) : null}

      {panel === 'pay-edit' && editingPayment ? (
        <Modal
          title={`Edit Payment — ${invoice.invoiceNo}`}
          onClose={() => { setPanel(null); setEditingPayment(null); }}
          okLabel="Save changes"
          form="pay-edit-form"
          busy={disabled}
        >
          <PaymentForm
            formId="pay-edit-form"
            amountDue={Number(totalPaise - paidPaise + asPaise(editingPayment.amountPaise) + asPaise(editingPayment.tdsPaise)) / 100}
            invoiceTotal={Number(totalPaise) / 100}
            existing={editingPayment}
            disabled={disabled}
            onSubmit={(body) => run(
              () => lifecycleApi.updatePayment(editingPayment.id!, body),
              'Payment updated.',
            )}
          />
        </Modal>
      ) : null}

      {panel === 'mrn' ? (
        <Modal
          title={`${invoice.mrn ? 'Edit MRN' : 'Create MRN'} — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel={invoice.mrn ? 'Save MRN corrections' : 'Record goods receipt (MRN)'}
          form="mrn-form"
          busy={disabled}
          wide
        >
          <MrnForm
            formId="mrn-form"
            mode={invoice.mrn ? 'edit' : 'create'}
            invoice={invoice}
            vehicles={vehicles}
            lineItems={lineItems}
            userName={user.name}
            disabled={disabled}
            onSubmit={(body) =>
              invoice.mrn
                ? run(() => lifecycleApi.updateMrn(invoice.id, body), 'MRN updated.')
                : run(() => lifecycleApi.createMrn(invoice.id, body), 'MRN created.')
            }
          />
        </Modal>
      ) : null}

      {panel === 'recy' ? (
        <Modal
          title={`${invoice.recycling ? 'Edit Form 6' : 'Process Invoice'} — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel={invoice.recycling ? 'Save Form 6' : 'Issue Form 6'}
          form="recy-form"
          busy={disabled}
          wide
        >
          <RecyclingForm
            formId="recy-form"
            lockedFactoryId={invoice.mrn!.factoryId}
            invoiceNo={invoice.invoiceNo}
            billingWeight={Number(invoice.billingWeight)}
            invoiceQty={
              invoice.mrn?.materials?.reduce((s, m) => s + Number(m.q ?? 0), 0) ||
              lineItems.reduce((s, it) => s + Number(it.qty || 0), 0)
            }
            ewayBillNo={invoice.ewayBillNo}
            vehicles={covered}
            initial={
              invoice.recycling
                ? {
                    processedAt: invoice.recycling.processedAt?.slice(0, 10),
                    factoryId: invoice.recycling.factoryId,
                    devicesDestroyed: invoice.recycling.devicesDestroyed,
                    vehicleIds: invoice.recycling.vehicleIds,
                    photoIds: invoice.recycling.photoIds,
                    reportIds: invoice.recycling.reportIds,
                    categories: (invoice.recycling.categories ?? []).map((c) => ({
                      entryId: c.entryId,
                      groupCode: c.groupCode,
                      weightKg: Number(c.weightKg),
                      recoveryFe: Number(c.recoveryFe ?? 0),
                      recoveryNfe: Number(c.recoveryNfe ?? 0),
                      recoveryPl: Number(c.recoveryPl ?? 0),
                      recoveryPcb: Number(c.recoveryPcb ?? 0),
                    })),
                  }
                : undefined
            }
            seedHints={
              invoice.mrn?.materials?.length
                ? invoice.mrn.materials.map((m) => ({
                    name: m.n ?? '',
                    qty: m.q ?? 0,
                    weightKg: m.w ?? 0,
                  }))
                : lineItems.map((it) => ({
                    name: it.name,
                    qty: it.qty,
                    weightKg: Number(it.weightKg) || 0,
                  }))
            }
            disabled={disabled}
            onSubmit={(body) =>
              invoice.recycling
                ? run(() => lifecycleApi.updateRecycling(invoice.id, body), 'Form 6 updated.')
                : run(() => lifecycleApi.createRecycling(invoice.id, body), 'Recycling recorded.')
            }
          />
        </Modal>
      ) : null}

      {panel === 'cod' ? (
        <Modal
          title={`Upload Certificate of Destruction — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Upload certificate"
          form="cod-form"
          busy={disabled}
          wide
        >
          <CertificateForm
            formId="cod-form"
            invoiceNo={invoice.invoiceNo}
            existingCerts={invoice.certificates}
            disabled={disabled}
            onSubmit={(body) =>
              run(() => lifecycleApi.uploadCertificate(invoice.id, body), 'Certificate uploaded.')
            }
          />
        </Modal>
      ) : null}

      {panel === 'close' ? (
        <Modal
          title={`Review & Close — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Acknowledge closure"
          form="close-form"
          busy={disabled}
        >
          <CloseForm
            formId="close-form"
            disabled={disabled}
            isAdmin={isAdmin}
            onSubmit={(body) => run(() => lifecycleApi.closeInvoice(invoice.id, body), 'Invoice closed.')}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function MrnCard({
  invoice,
  vehicles,
  canCreate,
  canEdit,
  onCreateClick,
  onEditClick,
  embedded = false,
}: {
  invoice: InvoiceDetail;
  vehicles: VehicleDetail[];
  canCreate: boolean;
  canEdit: boolean;
  onCreateClick: () => void;
  onEditClick: () => void;
  embedded?: boolean;
}) {
  const m = invoice.mrn;
  if (!m && !canCreate) return null;
  const mats = Array.isArray(m?.materials) ? m.materials : [];
  const matQty = mats.reduce((s, x) => s + Number(x.q ?? 0), 0);
  const matWt = mats.reduce((s, x) => s + Number(x.w ?? 0), 0);
  const actions = (
    <>
      {m ? (
        <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/mrn.pdf`)} target="_blank" rel="noreferrer">
          ⬇ Print MRN
        </a>
      ) : null}
      {canEdit ? (
        <button type="button" className="btn bs bsm" onClick={onEditClick}>
          Edit MRN
        </button>
      ) : null}
    </>
  );

  const body = (
    <>
      {!embedded ? (
        <div style={{ fontSize: '.73rem', color: 'var(--mu)', marginBottom: '.5rem' }}>
          🔒 Internal gate document — one MRN per invoice, not visible in the client portal
        </div>
      ) : null}
      {!m ? (
        <>
          <div className="dim" style={{ fontSize: '.83rem' }}>
            Goods not yet received at the factory. The factory manager records vehicle arrival and
            weighment on the gate.
          </div>
          {canCreate ? (
            <button type="button" className="btn bp bsm" style={{ marginTop: '.5rem' }} onClick={onCreateClick}>
              Create MRN
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
              gap: '.45rem',
              marginBottom: '.5rem',
            }}
          >
            <div className="tile">
              <div className="tile-l">Linked invoice</div>
              <div className="tile-v mono">{invoice.invoiceNo}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Factory Site</div>
              <div className="tile-v">{m.factory?.name || m.factoryId}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Received On</div>
              <div className="tile-v">{fmtDate(m.receivedAt)}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Billed / received</div>
              <div className="tile-v mono">
                {num(Number(invoice.billingWeight))} / {num(matWt)} kg
              </div>
            </div>
            <div className="tile">
              <div className="tile-l">Received By</div>
              <div className="tile-v">{m.receivedBy || '—'}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Condition</div>
              <div className="tile-v">{m.condition || '—'}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Driver Sign</div>
              <div className="tile-v">{m.driverSign || '—'}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Factory Mgr</div>
              <div className="tile-v">{m.managerSign || '—'}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Security</div>
              <div className="tile-v">{m.securitySign || '—'}</div>
            </div>
          </div>
          <div style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--g2)', marginBottom: '.25rem' }}>
            Vehicles verified at the gate
          </div>
          <div className="tw" style={{ marginBottom: '.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Gross</th>
                  <th>Tare</th>
                  <th>Net</th>
                  <th>Slip #</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.registration}</td>
                    <td>{v.driverName}</td>
                    <td className="mono">{v.weighment?.grossKg != null ? num(Number(v.weighment.grossKg)) : '—'}</td>
                    <td className="mono">{v.weighment?.tareKg != null ? num(Number(v.weighment.tareKg)) : '—'}</td>
                    <td className="mono">
                      <b>{v.weighment ? num(Number(v.weighment.netKg)) : '—'}</b>
                    </td>
                    <td className="mono dim">{v.weighment?.slipNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mats.length ? (
            <>
              <div style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--g2)', marginBottom: '.25rem' }}>
                Material received as counted
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qty</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((x, i) => (
                      <tr key={`${x.n}-${i}`}>
                        <td>{x.n || '—'}</td>
                        <td className="mono">{x.q ?? '—'}</td>
                        <td className="mono">{x.w != null ? `${x.w} kg` : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--g3)', fontWeight: 700 }}>
                      <td>Total received</td>
                      <td className="mono">{matQty}</td>
                      <td className="mono">{num(matWt)} kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {(m.gatePhotoIds?.length || m.materialPhotoIds?.length) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.5rem' }}>
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
                  Vehicle at the gate
                </div>
                <FileRow ids={m.gatePhotoIds} kind="image" />
              </div>
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--g2)', marginBottom: '.2rem' }}>
                  Material inside the vehicle
                </div>
                <FileRow ids={m.materialPhotoIds} kind="image" />
              </div>
            </div>
          ) : null}
          <div className="dim" style={{ fontSize: '.73rem', marginTop: '.35rem' }}>
            Category classification happens at the recycling stage, once material is segregated inside
            the facility.
          </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="inv-split">
        <div className="inv-split-hd">
          <div className="inv-split-ttl">Material receiving</div>
          {m ? <span className="badge bg-bl mono">{m.mrnNo}</span> : <span className="badge bg-am">Pending</span>}
          <div className="spacer" />
          {actions}
        </div>
        {body}
      </div>
    );
  }

  return (
    <CollapsibleCard
      title="📋 Material Receipt Note"
      badge={m ? <span className="badge bg-bl mono">{m.mrnNo}</span> : <span className="badge bg-am">Pending</span>}
      defaultOpen={!m || !invoice.recycling}
      style={{ marginBottom: '.6rem' }}
      summary={
        m ? (
          <span>
            Invoice {invoice.invoiceNo} · {fmtDate(m.receivedAt)} · {num(matWt)} kg
          </span>
        ) : (
          'Goods not yet received'
        )
      }
      actions={actions}
    >
      {body}
    </CollapsibleCard>
  );
}

function RecyclingCard({
  invoice,
  canCreate,
  canEdit,
  isStaff,
  onCreateClick,
  onEditClick,
}: {
  invoice: InvoiceDetail;
  canCreate: boolean;
  canEdit?: boolean;
  isStaff: boolean;
  onCreateClick: () => void;
  onEditClick?: () => void;
}) {
  const r = invoice.recycling;
  const cats = r?.categories ?? [];
  const serials = r?.serials ?? [];
  const destroyed = serials.filter((s) => s.dcodNo).length;
  const recFe = Number(r?.recoveryFe ?? 0);
  const recNfe = Number(r?.recoveryNfe ?? 0);
  const recPl = Number(r?.recoveryPl ?? 0);
  const recPcb = Number(r?.recoveryPcb ?? 0);
  const hasRecovery = recFe + recNfe + recPl + recPcb > 0;

  return (
    <CollapsibleCard
      title="♻️ Recycling / Form 6"
      badge={r ? <span className="badge bg-g mono">{r.form6No}</span> : <span className="badge bg-am">Pending</span>}
      defaultOpen={!r || !invoice.certificates.length}
      style={{ marginBottom: '.6rem' }}
      summary={
        r ? (
          <span>
            Invoice {invoice.invoiceNo} · {fmtDate(r.processedAt)} · billed {num(Number(invoice.billingWeight))} kg
          </span>
        ) : (
          'Awaiting processing'
        )
      }
      actions={
        r ? (
          <>
            {canEdit ? (
              <button type="button" className="btn bs bsm" onClick={onEditClick}>
                Edit Form 6
              </button>
            ) : null}
            <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/form6.pdf`)} target="_blank" rel="noreferrer">
              ⬇ Form 6
            </a>
          </>
        ) : null
      }
    >
      {!r ? (
        <>
          <div className="dim" style={{ fontSize: '.83rem' }}>
            Awaiting processing at the factory.
          </div>
          {canCreate ? (
            <button type="button" className="btn bp bsm" style={{ marginTop: '.5rem' }} onClick={onCreateClick}>
              Process & Issue Form 6
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
              gap: '.45rem',
              marginBottom: '.5rem',
            }}
          >
            <div className="tile">
              <div className="tile-l">Linked invoice</div>
              <div className="tile-v mono">{invoice.invoiceNo}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Form 6 #</div>
              <div className="tile-v mono">{r.form6No}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Processed</div>
              <div className="tile-v">{fmtDate(r.processedAt)}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Facility</div>
              <div className="tile-v">{r.factory?.name || r.factoryId || '—'}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Invoice billed</div>
              <div className="tile-v mono">{num(Number(invoice.billingWeight))} kg</div>
            </div>
            <div className="tile">
              <div className="tile-l">Devices Destroyed</div>
              <div className="tile-v">{r.devicesDestroyed ?? destroyed}</div>
            </div>
          </div>
          {cats.length ? (
            <>
              <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', margin: '.4rem 0 .25rem' }}>
                E-waste categories processed
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Description</th>
                      <th>Group</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c.entryId}>
                        <td className="mono">
                          <b>{c.entryId}</b>
                        </td>
                        <td className="dim">{(c.category?.description || '').slice(0, 55) || '—'}</td>
                        <td>
                          <span className="badge bg-bl">{c.groupCode}</span>
                        </td>
                        <td className="mono">{num(Number(c.weightKg))} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {(r.photoIds?.length || r.reportIds?.length) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.5rem' }}>
              <div>
                <div style={{ fontSize: '.73rem', fontWeight: 600, color: 'var(--g2)', marginBottom: '.2rem' }}>
                  Processing photos ({r.photoIds?.length ?? 0})
                </div>
                <FileRow ids={r.photoIds} kind="image" />
              </div>
              <div>
                <div style={{ fontSize: '.73rem', fontWeight: 600, color: 'var(--g2)', marginBottom: '.2rem' }}>
                  Reports ({r.reportIds?.length ?? 0})
                </div>
                <FileRow ids={r.reportIds} kind="doc" />
              </div>
            </div>
          ) : null}
          {hasRecovery ? (
            <>
              <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', margin: '.5rem 0 .25rem' }}>
                Material recovery by category
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Received</th>
                      <th style={{ textAlign: 'right' }}>Ferrous</th>
                      <th style={{ textAlign: 'right' }}>Non-Ferrous</th>
                      <th style={{ textAlign: 'right' }}>Plastics</th>
                      <th style={{ textAlign: 'right' }}>PCB / Boards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={`rec-${c.entryId}`}>
                        <td className="mono">
                          {c.entryId}
                          <div className="dim" style={{ fontSize: '.68rem' }}>
                            {c.groupCode}
                          </div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {num(Number(c.weightKg))}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {num(Number(c.recoveryFe ?? 0))}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {num(Number(c.recoveryNfe ?? 0))}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {num(Number(c.recoveryPl ?? 0))}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {num(Number(c.recoveryPcb ?? 0))}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--g3)', fontWeight: 700 }}>
                      <td>Total recovered</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(cats.reduce((s, c) => s + Number(c.weightKg || 0), 0))}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(recFe)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(recNfe)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(recPl)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {num(recPcb)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {serials.length ? (
            <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', margin: '.6rem 0 .3rem' }}>
              Device serial tracking ({serials.length})
              <span className="badge bg-g" style={{ marginLeft: '.4rem' }}>{destroyed} destroyed</span>
              {serials.length - destroyed > 0 ? (
                <span className="badge bg-am" style={{ marginLeft: '.35rem' }}>
                  {serials.length - destroyed} in custody
                </span>
              ) : null}
            </div>
          ) : isStaff ? (
            <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', margin: '.6rem 0 .3rem' }}>
              Serial-level custody (0)
            </div>
          ) : null}
        </>
      )}
    </CollapsibleCard>
  );
}

function CertificateForm({
  formId,
  invoiceNo,
  existingCerts,
  disabled,
  onSubmit,
}: {
  formId?: string;
  invoiceNo: string;
  existingCerts?: Array<{ certNo: string; department?: string | null }>;
  disabled: boolean;
  onSubmit: (body: {
    certNo: string;
    certDate: string;
    fileId: string;
    department?: string;
    note?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [certNo, setCertNo] = useState(`URB/COD/${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}/0001`);
  const [certDate, setCertDate] = useState(today);
  const [department, setDepartment] = useState('');
  const [note, setNote] = useState('');
  const [fileId, setFileId] = useState('');

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!fileId) return;
        onSubmit({
          certNo: certNo.trim(),
          certDate,
          fileId,
          department: department.trim() || undefined,
          note: note.trim() || undefined,
        });
      }}
    >
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.8rem' }}>
        The certificate is prepared outside the system. Upload the signed PDF here. Upload one certificate per
        department if the client needs them split. Use Compliance Documents on the request to email certificates
        to the client when ready.
      </p>
      {existingCerts?.length ? (
        <div
          style={{
            background: 'var(--g3)',
            padding: '.5rem .8rem',
            borderRadius: 8,
            fontSize: '.8rem',
            marginBottom: '.8rem',
          }}
        >
          Already on invoice {invoiceNo}:{' '}
          {existingCerts.map((c, i) => (
            <span key={c.certNo}>
              {i ? ' · ' : ''}
              <b className="mono">{c.certNo}</b>
              {c.department ? ` (${c.department})` : ''}
            </span>
          ))}
        </div>
      ) : null}
      <div className="fr2">
        <label>
          Certificate Number *
          <input
            value={certNo}
            onChange={(e) => setCertNo(e.target.value)}
            placeholder="URB/COD/2627/0001"
            className="mono"
            required
          />
        </label>
        <DateField
          label="Certificate Date *"
          value={certDate}
          max={today}
          onChange={setCertDate}
          required
        />
      </div>
      <label>
        Department / Scope{' '}
        <span className="dim" style={{ fontWeight: 400 }}>
          optional — use when splitting one pickup across departments
        </span>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. End-User Computing, or Finance Dept assets"
        />
      </label>
      <label>
        Note{' '}
        <span className="dim" style={{ fontWeight: 400 }}>
          optional
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="anything the client should know about this certificate"
        />
      </label>
      <div className="section-hd" style={{ marginTop: '.3rem' }}>
        Certificate PDF * <span className="hint" style={{ fontWeight: 400 }}>max 5 MB</span>
      </div>
      <FileUpload
        kind="certificate"
        label="Attach Certificate PDF"
        hint="PDF only · max 5 MB"
        accept="application/pdf"
        required
        disabled={disabled}
        value={fileId ? [fileId] : []}
        onChange={(ids) => setFileId(ids[0] ?? '')}
      />
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled || !fileId}>
          Upload certificate
        </button>
      )}
    </form>
  );
}

function PaymentForm({
  formId,
  amountDue,
  invoiceTotal,
  existing,
  disabled,
  onSubmit,
}: {
  formId?: string;
  amountDue: number;
  invoiceTotal?: number;
  existing?: { utr?: string; amountPaise: string; tdsPaise?: string; paidAt?: string; mode?: string; note?: string | null } | null;
  disabled: boolean;
  onSubmit: (body: { utr: string; amount: number; tdsAmount: number; paidAt: string; mode: string; note?: string }) => void;
}) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayYmd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const paymentModes = useLookups('paymentMode');
  const [utr, setUtr] = useState(existing?.utr ?? '');
  const [amount, setAmount] = useState(existing ? String(Number(asPaise(existing.amountPaise)) / 100) : String(amountDue));
  const [tdsAmount, setTdsAmount] = useState(existing ? String(Number(asPaise(existing.tdsPaise ?? '0')) / 100) : '0');
  const [paidAt, setPaidAt] = useState(existing?.paidAt?.slice(0, 10) ?? todayYmd);
  const [mode, setMode] = useState(existing?.mode ?? 'PM1');
  const [note, setNote] = useState(existing?.note ?? '');
  const received = Number(amount) || 0;
  const tds = Number(tdsAmount) || 0;
  const settled = received + tds;
  const overLimit = invoiceTotal !== undefined && settled > invoiceTotal + 0.005;

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (overLimit) return;
        onSubmit({ utr, amount: received, tdsAmount: tds, paidAt, mode, note: note.trim() || undefined });
      }}
    >
      <h3>{existing ? 'Edit payment' : 'Record payment'}</h3>
      <div className="fr2">
        <DateField label="Payment date" value={paidAt} max={todayYmd} onChange={setPaidAt} required />
        <label>
          Payment mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {paymentModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="fr2">
        <label>
          UTR / reference
          <input value={utr} onChange={(e) => setUtr(e.target.value)} required />
        </label>
        <label>
          Amount received (₹)
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
      </div>
      <div className="fr2">
        <label>
          TDS deducted (₹)
          <input type="number" step="0.01" min="0" value={tdsAmount} onChange={(e) => setTdsAmount(e.target.value)} />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" />
        </label>
      </div>
      <div className="dim" style={{ fontSize: '.78rem' }}>
        Outstanding on this invoice: {formatINR(amountDue * 100)}. This entry settles: {formatINR(settled * 100)}{' '}
        (amount received + TDS).{invoiceTotal ? ` Invoice total: ${formatINR(invoiceTotal * 100)}.` : ''}
      </div>
      {overLimit ? (
        <p className="error" style={{ margin: '.4rem 0 0' }}>
          Total payments would exceed the invoice value. Reduce the amount or TDS.
        </p>
      ) : null}
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled || overLimit}>
          {existing ? 'Save changes' : 'Record payment'}
        </button>
      )}
    </form>
  );
}

function CloseForm({
  formId,
  disabled,
  isAdmin,
  onSubmit,
}: {
  formId?: string;
  disabled: boolean;
  isAdmin: boolean;
  onSubmit: (body: { rating?: number; note?: string; forced?: boolean }) => void;
}) {
  const [rating, setRating] = useState('5');
  const [note, setNote] = useState('');

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ rating: Number(rating), note: note || undefined });
      }}
    >
      <h3>Close invoice</h3>
      <div className="fr2">
        <label>
          Rating (1–5)
          <input type="number" min="1" max="5" value={rating} onChange={(e) => setRating(e.target.value)} />
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional feedback" />
        </label>
      </div>
      {isAdmin ? (
        <button
          type="button"
          className="btn ghost"
          disabled={disabled}
          onClick={() => onSubmit({ forced: true, note: 'Admin force-close' })}
        >
          Force close (60+ days)
        </button>
      ) : null}
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          Acknowledge closure
        </button>
      )}
    </form>
  );
}

function SerialPanel({
  invoice,
  disabled,
  readOnly = false,
  onAction,
}: {
  invoice: InvoiceDetail;
  disabled: boolean;
  readOnly?: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
}) {
  const serials = invoice.recycling?.serials ?? [];
  const pending = serials.filter((s) => !s.dcodNo).length;
  const destroyed = serials.length - pending;
  const standards = useLookups('destructStd');
  const [std, setStd] = useState('NIST');
  const [destroyOpen, setDestroyOpen] = useState(false);

  async function onCsv(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const rec = await import('../api').then(({ filesApi: fa }) => fa.upload(file, 'serials'));
    const csv = await file.text();
    await onAction(
      () => lifecycleApi.importSerials(invoice.id, { csv, serialFileId: rec.id }),
      `${csv.split(/\n/).length - 1} serials imported.`,
    );
  }

  async function recordDestroy() {
    const ok = await onAction(
      () => lifecycleApi.destroySerials(invoice.id, { serialNos: 'all', std }),
      'Destruction recorded.',
    );
    if (ok !== false) setDestroyOpen(false);
  }

  return (
    <div className="sub-form" id="serial-tracking">
      <h3>{readOnly ? 'Device last-mile tracking' : 'Serial-level custody'} ({serials.length})</h3>
      <p className="dim" style={{ fontSize: '.8rem' }}>
        {readOnly ? (
          'Search any device serial or asset tag in the header to jump here. Status shows custody through secure destruction.'
        ) : (
          <>
            Upload a CSV with headers Serial, AssetTag, Item, Condition, Weight —{' '}
            <a href={filesApi.pdf('/serials/template.csv')}>sample CSV</a>.
          </>
        )}
      </p>
      {serials.length ? (
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.55rem' }}>
          <span className="badge bg-g">{destroyed} destroyed</span>
          {pending > 0 ? <span className="badge bg-am">{pending} in custody</span> : null}
        </div>
      ) : null}
      {!readOnly ? (
        <input type="file" accept=".csv,text/csv" disabled={disabled} onChange={(e) => void onCsv(e.target.files)} />
      ) : null}
      {serials.length ? (
        <div className="tw" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Serial</th>
                <th>Asset Tag</th>
                <th>Device</th>
                <th>Status</th>
                <th>Device CoD</th>
              </tr>
            </thead>
            <tbody>
              {serials.slice(0, 60).map((s) => (
                <tr key={s.id}>
                  <td className="mono">
                    <b>{s.serialNo}</b>
                  </td>
                  <td className="mono dim">{s.assetTag || '—'}</td>
                  <td className="dim">{[s.make, s.model].filter(Boolean).join(' ') || '—'}</td>
                  <td>
                    {s.destroyStd || s.dcodNo ? (
                      <span className="badge bg-bl">{lookupLabel(standards, s.destroyStd, s.destroyStd || 'Destroyed')}</span>
                    ) : (
                      <span className="badge bg-am">in custody</span>
                    )}
                  </td>
                  <td className="mono">{s.dcodNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dim" style={{ fontSize: '.8rem' }}>
          {readOnly ? (
            'No device serials recorded on this request yet.'
          ) : (
            <>
              No serials imported yet. Upload a CSV with the headers{' '}
              <span className="mono">Serial, AssetTag, Item, Condition, Weight</span>.
            </>
          )}
        </div>
      )}
      {serials.length > 60 ? (
        <div className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
          Showing 60 of {serials.length}
        </div>
      ) : null}
      {!readOnly && pending > 0 ? (
        <button type="button" className="btn bp bsm" disabled={disabled} onClick={() => setDestroyOpen(true)}>
          Record destruction ({pending})
        </button>
      ) : null}
      {destroyOpen ? (
        <Modal
          title={`Record Data Destruction — ${invoice.invoiceNo}`}
          onClose={() => setDestroyOpen(false)}
          okLabel="Record destruction"
          busy={disabled}
          onOk={() => recordDestroy()}
        >
          <p className="dim" style={{ fontSize: '.83rem', marginBottom: '.8rem' }}>
            {pending} serial{pending === 1 ? '' : 's'} still pending sanitization. Recording destruction issues a
            device-level Certificate of Destruction for each.
          </p>
          <label>
            Sanitization standard
            <select value={std} onChange={(e) => setStd(e.target.value)}>
              {(standards.length ? standards : [{ id: 'NIST', label: 'NIST SP 800-88' }]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
