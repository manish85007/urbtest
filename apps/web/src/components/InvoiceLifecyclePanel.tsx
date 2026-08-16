import { useEffect, useState } from 'react';
import {
  formatINR,
  getPayStatus,
  invoiceDue,
  paymentTermsLabel,
  recyclingSla,
  SLA_CLASS,
  SLA_LABEL,
  type PayStatusKey,
} from '@urb-tectrack/shared';
import {
  dataApi,
  filesApi,
  lifecycleApi,
  type InvoiceDetail,
  type SessionUser,
  type VehicleDetail,
} from '../api';
import { FileUpload } from './FileUpload';
import { FileRow, FileThumb } from './FileThumb';
import { Modal } from './Modal';
import { lookupLabel, useLookups } from '../hooks/useLookups';
import { fmtDate, num } from '../lib/format';

interface InvoiceLifecyclePanelProps {
  invoice: InvoiceDetail;
  vehicles: VehicleDetail[];
  payTermsDays: number;
  user: SessionUser;
  disabled: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
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
  payTermsDays,
  user,
  disabled,
  onAction,
}: InvoiceLifecyclePanelProps) {
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const isFactory = user.role === 'factory' || user.role === 'admin';
  const isAdmin = user.role === 'admin';
  const isClient = user.role === 'client';
  const paymentModes = useLookups('paymentMode');
  const taxRates = useLookups('taxRate');
  const [panel, setPanel] = useState<'pay' | 'mrn' | 'recy' | 'cod' | 'close' | null>(null);

  async function run(fn: () => Promise<unknown>, success: string) {
    const ok = await onAction(fn, success);
    if (ok !== false) setPanel(null);
  }

  const paidPaise = invoice.payments.reduce((s, p) => s + asPaise(p.amountPaise), 0n);
  const totalPaise = asPaise(invoice.totalPaise);
  const taxablePaise = asPaise(invoice.taxablePaise);
  const taxPaise = asPaise(invoice.taxPaise);
  const pay = getPayStatus(totalPaise, paidPaise);
  const isPaid = pay.key === 'paid';
  const stage = invoice.derivedStage;
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
  const deviation = Number(invoice.deviationKg ?? 0);
  const firstCert = invoice.certificates[0]?.certDate ?? invoice.certificates[0]?.mailedAt;
  const sla =
    invoice.mrn?.receivedAt
      ? recyclingSla({
          mrnReceivedAt: new Date(invoice.mrn.receivedAt),
          certificateAt: firstCert ? new Date(firstCert) : null,
        })
      : null;
  const slaColor =
    sla?.state === 'met'
      ? 'var(--g)'
      : sla?.state === 'warn'
        ? 'var(--am)'
        : sla?.state === 'ok'
          ? 'var(--bl)'
          : 'var(--rd)';

  return (
    <div className="inv-panel" style={{ padding: '.7rem .3rem 0' }}>
      <div className="card" style={{ marginBottom: '.6rem' }}>
        <div className="card-hd">
          <div className="card-ttl">🧾 Invoice {invoice.invoiceNo}</div>
          <span className={`badge ${payCls(pay.key)}`}>{pay.label}</span>
        </div>
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
            {deviation ? (
              <div style={{ fontSize: '.68rem', color: 'var(--am)' }}>
                {deviation > 0 ? '+' : ''}
                {num(deviation)} kg vs weighed
              </div>
            ) : (
              <div className="dim" style={{ fontSize: '.68rem' }}>
                matches weighed net
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
              {invoice.invoiceFileId ? (
                <FileThumb id={invoice.invoiceFileId} kind="doc" name="Invoice" />
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
              {invoice.ewayFileId ? (
                <FileThumb id={invoice.ewayFileId} kind="doc" name="E-way" />
              ) : (
                <span className="dim" style={{ fontSize: '.75rem' }}>
                  not attached
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '.6rem' }}>
        <div className="card-hd">
          <div className="card-ttl">💰 Payments</div>
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
        </div>
        <div className="dim" style={{ fontSize: '.75rem', marginBottom: '.4rem' }}>
          Terms: {paymentTermsLabel(payTermsDays)}
          {due ? ` · due ${fmtDate(due.dueDate)}` : ''}
          {pay.key !== 'paid' && due?.isOverdue ? (
            <>
              {' · '}
              <span style={{ color: 'var(--rd)', fontWeight: 700 }}>reminders sending daily</span>
            </>
          ) : null}
        </div>
        {!invoice.payments.length ? (
          <div className="dim" style={{ fontSize: '.82rem' }}>
            No payments recorded
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>UTR / Ref</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p, i) => (
                  <tr key={p.id ?? `${p.utr}-${i}`}>
                    <td className="mono">{p.utr || '—'}</td>
                    <td className="mono">{formatINR(Number(asPaise(p.amountPaise)))}</td>
                    <td className="dim">{fmtDate(p.paidAt)}</td>
                    <td>{lookupLabel(paymentModes, p.mode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isStaff && stage >= 5 && !isPaid && !invoice.closedAt ? (
          <button type="button" className="btn bs bsm" onClick={() => setPanel('pay')}>
            + Record Payment
          </button>
        ) : null}
      </div>

      {sla ? (
        <div className="card" style={{ marginBottom: '.6rem' }}>
          <div className="card-hd">
            <div className="card-ttl">⏱️ Recycling SLA</div>
            <span className={`badge ${SLA_CLASS[sla.state]}`}>{SLA_LABEL[sla.state]}</span>
            <div className="spacer" />
            <span className="dim" style={{ fontSize: '.76rem' }}>
              {sla.slaDays}-day target from receipt of material
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))',
              gap: '.45rem',
              marginBottom: '.45rem',
            }}
          >
            <div className="tile">
              <div className="tile-l">Material Received</div>
              <div className="tile-v">{fmtDate(sla.start.toISOString())}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Certificate Target</div>
              <div className="tile-v">{fmtDate(sla.targetDate)}</div>
            </div>
            <div className="tile">
              <div className="tile-l">{sla.done ? 'Certificate Issued' : 'Days Elapsed'}</div>
              <div className="tile-v" style={{ color: slaColor }}>
                {sla.done ? fmtDate(sla.endAt?.toISOString()) : `${sla.daysUsed} of ${sla.slaDays}`}
              </div>
            </div>
            <div className="tile">
              <div className="tile-l">
                {sla.done ? 'Turnaround' : sla.remaining >= 0 ? 'Days Remaining' : 'Days Over'}
              </div>
              <div className="tile-v" style={{ color: slaColor }}>
                {sla.done ? `${sla.daysUsed} days` : Math.abs(sla.remaining)}
              </div>
            </div>
          </div>
          <div className="bar">
            <div
              className="bar-f"
              style={{ width: `${Math.min(100, sla.pct * 100)}%`, background: slaColor }}
            />
            <div className="bar-t">{Math.round(Math.min(100, sla.pct * 100))}%</div>
          </div>
          <div className="dim" style={{ fontSize: '.75rem', marginTop: '.3rem' }}>
            {sla.done
              ? sla.breached
                ? `Certificate issued ${sla.daysUsed - sla.slaDays} day${sla.daysUsed - sla.slaDays === 1 ? '' : 's'} beyond the ${sla.slaDays}-day target.`
                : `Certificate issued within target, ${sla.slaDays - sla.daysUsed} day${sla.slaDays - sla.daysUsed === 1 ? '' : 's'} to spare.`
              : sla.breached
                ? `Past the ${sla.slaDays}-day target by ${sla.daysUsed - sla.slaDays} day${sla.daysUsed - sla.slaDays === 1 ? '' : 's'}. Issue the certificate to stop the clock.`
                : 'The clock stops when the first Certificate of Destruction is issued against this invoice.'}
          </div>
        </div>
      ) : null}

      {isStaff ? (
        <MrnCard
          invoice={invoice}
          vehicles={covered}
          canCreate={isFactory && stage === 5 && !invoice.mrn}
          onCreateClick={() => setPanel('mrn')}
        />
      ) : null}

      <RecyclingCard
        invoice={invoice}
        canCreate={isFactory && stage === 6 && !!invoice.mrn && !invoice.recycling}
        isStaff={isStaff}
        onCreateClick={() => setPanel('recy')}
      />

      {isAdmin && stage >= 7 && invoice.recycling && !invoice.closedAt ? (
        <div className="card" style={{ marginBottom: '.6rem' }}>
          <div className="card-hd">
            <div className="card-ttl">🏅 Certificate of Destruction</div>
            <div className="spacer" />
            <button type="button" className="btn bp bsm" onClick={() => setPanel('cod')}>
              Upload Certificate
            </button>
          </div>
          {invoice.certificates.length ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Certificate</th>
                    <th>Issued</th>
                    <th>Emailed</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.certificates.map((c) => (
                    <tr key={c.id ?? c.certNo}>
                      <td className="mono">{c.certNo}</td>
                      <td className="dim">{fmtDate(c.certDate)}</td>
                      <td>{c.mailedAt ? <span className="badge bg-g">sent</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dim" style={{ fontSize: '.83rem' }}>
              Upload the signed PDF — the client is emailed automatically with it attached.
            </div>
          )}
        </div>
      ) : null}

      {isStaff && invoice.recycling ? (
        <SerialPanel invoice={invoice} disabled={disabled} onAction={onAction} />
      ) : null}

      {(isClient || isAdmin) && stage >= 8 && !invoice.closedAt && isPaid && invoice.certificates.length > 0 ? (
        <div className="card" style={{ marginBottom: '.6rem' }}>
          <div className="card-hd">
            <div className="card-ttl">🎉 Review & Close</div>
            <div className="spacer" />
            <button type="button" className="btn bp bsm" onClick={() => setPanel('close')}>
              Review & Close
            </button>
          </div>
          <div className="dim" style={{ fontSize: '.83rem' }}>
            Confirm you have received the Certificate of Destruction, then acknowledge closure.
          </div>
        </div>
      ) : null}

      {invoice.closedAt ? (
        <p className="ok-msg sm">Closed {invoice.closedAt.slice(0, 10)}</p>
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
            disabled={disabled}
            onSubmit={(body) => run(() => lifecycleApi.addPayment(invoice.id, body), 'Payment recorded.')}
          />
        </Modal>
      ) : null}

      {panel === 'mrn' ? (
        <Modal
          title={`Create MRN — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Record goods receipt (MRN)"
          form="mrn-form"
          busy={disabled}
          wide
        >
          <MrnForm
            formId="mrn-form"
            disabled={disabled}
            onSubmit={(body) => run(() => lifecycleApi.createMrn(invoice.id, body), 'MRN created.')}
          />
        </Modal>
      ) : null}

      {panel === 'recy' ? (
        <Modal
          title={`Process Invoice — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Issue Form 6"
          form="recy-form"
          busy={disabled}
          wide
        >
          <RecyclingForm
            formId="recy-form"
            defaultFactoryId={invoice.mrn?.factoryId ?? 'URB-BLR'}
            billingWeight={Number(invoice.billingWeight)}
            disabled={disabled}
            onSubmit={(body) => run(() => lifecycleApi.createRecycling(invoice.id, body), 'Recycling recorded.')}
          />
        </Modal>
      ) : null}

      {panel === 'cod' ? (
        <Modal
          title={`Upload Certificate of Destruction — ${invoice.invoiceNo}`}
          onClose={() => setPanel(null)}
          okLabel="Upload & email certificate"
          form="cod-form"
          busy={disabled}
          wide
        >
          <CertificateForm
            formId="cod-form"
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
  onCreateClick,
}: {
  invoice: InvoiceDetail;
  vehicles: VehicleDetail[];
  canCreate: boolean;
  onCreateClick: () => void;
}) {
  const m = invoice.mrn;
  if (!m && !canCreate) return null;
  const mats = Array.isArray(m?.materials) ? m.materials : [];
  const matQty = mats.reduce((s, x) => s + Number(x.q ?? 0), 0);
  const matWt = mats.reduce((s, x) => s + Number(x.w ?? 0), 0);

  return (
    <div className="card" style={{ marginBottom: '.6rem' }}>
      <div className="card-hd">
        <div className="card-ttl">📋 Material Receipt Note</div>
        {m ? (
          <span className="badge bg-bl mono">{m.mrnNo}</span>
        ) : (
          <span className="badge bg-am">Pending</span>
        )}
        <div className="spacer" />
        {m ? (
          <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/mrn.pdf`)} target="_blank" rel="noreferrer">
            ⬇ Print MRN
          </a>
        ) : null}
      </div>
      <div style={{ fontSize: '.73rem', color: 'var(--mu)', marginBottom: '.5rem' }}>
        🔒 Internal gate document — not visible in the client portal
      </div>
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
              <div className="tile-l">Factory Site</div>
              <div className="tile-v">{m.factory?.name || m.factoryId}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Received On</div>
              <div className="tile-v">{fmtDate(m.receivedAt)}</div>
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
          <div className="dim" style={{ fontSize: '.73rem', marginTop: '.35rem' }}>
            Category classification happens at the recycling stage, once material is segregated inside
            the facility.
          </div>
        </>
      )}
    </div>
  );
}

function RecyclingCard({
  invoice,
  canCreate,
  isStaff,
  onCreateClick,
}: {
  invoice: InvoiceDetail;
  canCreate: boolean;
  isStaff: boolean;
  onCreateClick: () => void;
}) {
  const r = invoice.recycling;
  if (!r && !canCreate) return null;
  const cats = r?.categories ?? [];
  const serials = r?.serials ?? [];
  const destroyed = serials.filter((s) => s.dcodNo).length;
  const recFe = Number(r?.recoveryFe ?? 0);
  const recNfe = Number(r?.recoveryNfe ?? 0);
  const recPl = Number(r?.recoveryPl ?? 0);
  const recPcb = Number(r?.recoveryPcb ?? 0);
  const hasRecovery = recFe + recNfe + recPl + recPcb > 0;

  return (
    <div className="card" style={{ marginBottom: '.6rem' }}>
      <div className="card-hd">
        <div className="card-ttl">♻️ Recycling</div>
        {r ? (
          <span className="badge bg-g mono">{r.form6No}</span>
        ) : (
          <span className="badge bg-am">Pending</span>
        )}
        <div className="spacer" />
        {r ? (
          <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/form6.pdf`)} target="_blank" rel="noreferrer">
            ⬇ Form 6
          </a>
        ) : null}
      </div>
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
              <div className="tile-l">Devices Destroyed</div>
              <div className="tile-v">{destroyed}</div>
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
          {isStaff ? (
            <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--g2)', margin: '.6rem 0 .3rem' }}>
              Serial-level custody ({serials.length})
              {serials.length ? <span className="badge bg-g" style={{ marginLeft: '.4rem' }}>{destroyed} destroyed</span> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function MrnForm({
  formId,
  disabled,
  onSubmit,
}: {
  formId?: string;
  disabled: boolean;
  onSubmit: (body: {
    factoryId: string;
    receivedAt: string;
    driverSign?: string;
    managerSign?: string;
    securitySign?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [factories, setFactories] = useState<Array<{ id: string; name: string }>>([]);
  const [factoryId, setFactoryId] = useState('URB-BLR');

  useEffect(() => {
    dataApi.factories().then(setFactories);
  }, []);

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ factoryId, receivedAt: today, driverSign: 'Driver', managerSign: 'Manager', securitySign: 'Security' });
      }}
    >
      <h3>Create MRN</h3>
      <label>
        Factory
        <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          Record goods receipt (MRN)
        </button>
      )}
    </form>
  );
}

function RecyclingForm({
  formId,
  defaultFactoryId,
  billingWeight,
  disabled,
  onSubmit,
}: {
  formId?: string;
  defaultFactoryId: string;
  billingWeight: number;
  disabled: boolean;
  onSubmit: (body: {
    processedAt: string;
    factoryId?: string;
    categories: Array<{ entryId: string; groupCode: string; weightKg: number; overrideReason?: string }>;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [factoryId, setFactoryId] = useState(defaultFactoryId);
  const [categories, setCategories] = useState<Array<{ entryId: string; description: string; groupCode: string }>>([]);
  const [entryId, setEntryId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!factoryId) return;
    dataApi.categories(factoryId).then((cats) => {
      setCategories(cats);
      if (cats[0]) setEntryId(cats[0].entryId);
    });
  }, [factoryId]);

  const selected = categories.find((c) => c.entryId === entryId);

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        onSubmit({
          processedAt: today,
          factoryId,
          categories: [{
            entryId: selected.entryId,
            groupCode: selected.groupCode,
            weightKg: billingWeight,
            ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
          }],
        });
      }}
    >
      <h3>Record recycling</h3>
      <label>
        Factory
        <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
          <option value="URB-BLR">Urbeno Bengaluru Facility</option>
          <option value="URB-KGF">Urbeno KGF Integrated Facility</option>
        </select>
      </label>
      <label>
        Category ({billingWeight} kg total)
        <select value={entryId} onChange={(e) => setEntryId(e.target.value)} required>
          {categories.slice(0, 50).map((c) => (
            <option key={c.entryId} value={c.entryId}>
              {c.entryId} — {c.description.slice(0, 60)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Capacity override reason
        <input
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Required only if category TPA would be exceeded"
        />
      </label>
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled || !selected}>
          Issue Form 6
        </button>
      )}
    </form>
  );
}

function CertificateForm({
  formId,
  disabled,
  onSubmit,
}: {
  formId?: string;
  disabled: boolean;
  onSubmit: (body: { certNo: string; certDate: string; fileId: string; department?: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [certNo, setCertNo] = useState(`URB/COD/${Date.now().toString().slice(-6)}`);
  const [fileId, setFileId] = useState('');

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!fileId) return;
        onSubmit({ certNo, certDate: today, fileId: fileId, department: '' });
      }}
    >
      <h3>Upload Certificate of Destruction</h3>
      <label>
        Certificate no.
        <input value={certNo} onChange={(e) => setCertNo(e.target.value)} required />
      </label>
      <FileUpload
        kind="certificate"
        label="Certificate PDF"
        hint="PDF only · max 5 MB"
        accept="application/pdf"
        required
        disabled={disabled}
        value={fileId ? [fileId] : []}
        onChange={(ids) => setFileId(ids[0] ?? '')}
      />
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled || !fileId}>
          Upload &amp; email certificate
        </button>
      )}
    </form>
  );
}

function PaymentForm({
  formId,
  amountDue,
  disabled,
  onSubmit,
}: {
  formId?: string;
  amountDue: number;
  disabled: boolean;
  onSubmit: (body: { utr: string; amount: number; paidAt: string; mode: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const paymentModes = useLookups('paymentMode');
  const [utr, setUtr] = useState('');
  const [amount, setAmount] = useState(String(amountDue));
  const [mode, setMode] = useState('PM1');

  return (
    <form
      id={formId}
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ utr, amount: Number(amount), paidAt: today, mode });
      }}
    >
      <h3>Record payment</h3>
      <div className="fr2">
        <label>
          UTR / reference
          <input value={utr} onChange={(e) => setUtr(e.target.value)} required />
        </label>
        <label>
          Amount (₹)
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
      </div>
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
      {formId ? null : (
        <button type="submit" className="btn primary" disabled={disabled}>
          Record payment
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
  onAction,
}: {
  invoice: InvoiceDetail;
  disabled: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
}) {
  const serials = invoice.recycling?.serials ?? [];
  const pending = serials.filter((s) => !s.dcodNo).length;
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
    <div className="sub-form">
      <h3>Serial-level custody ({serials.length})</h3>
      <p className="dim" style={{ fontSize: '.8rem' }}>
        Upload a CSV with headers Serial, AssetTag, Item, Condition, Weight —{' '}
        <a href={filesApi.pdf('/serials/template.csv')}>sample CSV</a>.
      </p>
      <input type="file" accept=".csv,text/csv" disabled={disabled} onChange={(e) => void onCsv(e.target.files)} />
      {serials.length ? (
        <div className="tw" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Serial</th>
                <th>Asset Tag</th>
                <th>Standard</th>
                <th>Operator</th>
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
                  <td>
                    {s.destroyStd ? (
                      <span className="badge bg-bl">{lookupLabel(standards, s.destroyStd, s.destroyStd)}</span>
                    ) : (
                      <span className="badge bg-am">pending</span>
                    )}
                  </td>
                  <td className="dim">{s.destroyOp || '—'}</td>
                  <td className="mono">{s.dcodNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dim" style={{ fontSize: '.8rem' }}>
          No serials imported yet. Upload a CSV with the headers{' '}
          <span className="mono">Serial, AssetTag, Item, Condition, Weight</span>.
        </div>
      )}
      {serials.length > 60 ? (
        <div className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
          Showing 60 of {serials.length}
        </div>
      ) : null}
      {pending > 0 ? (
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
