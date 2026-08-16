import { useEffect, useState } from 'react';
import { formatINR, stageLabel } from '@urb-tectrack/shared';
import {
  dataApi,
  filesApi,
  lifecycleApi,
  type InvoiceDetail,
  type SessionUser,
} from '../api';
import { FileUpload } from './FileUpload';
import { useLookups } from '../hooks/useLookups';

interface InvoiceLifecyclePanelProps {
  invoice: InvoiceDetail;
  user: SessionUser;
  disabled: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => void;
}

export function InvoiceLifecyclePanel({ invoice, user, disabled, onAction }: InvoiceLifecyclePanelProps) {
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const isFactory = user.role === 'factory' || user.role === 'admin';
  const isAdmin = user.role === 'admin';
  const isClient = user.role === 'client';

  const paidPaise = invoice.payments.reduce((s, p) => s + BigInt(p.amountPaise), 0n);
  const totalPaise = BigInt(invoice.totalPaise);
  const isPaid = paidPaise + 1n >= totalPaise;
  const stage = invoice.derivedStage;

  return (
    <div className="inv-panel">
      <div className="inv-panel-hd">
        <strong>{invoice.invoiceNo}</strong>
        <span className="badge">{stageLabel(stage)}</span>
        <span className="dim">{invoice.billingWeight} kg</span>
        <span className="dim">{formatINR(Number(totalPaise))}</span>
      </div>

      {invoice.mrn ? (
        <p className="muted sm">
          MRN: {invoice.mrn.mrnNo}{' '}
          {user.role !== 'client' ? (
            <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/mrn.pdf`)} target="_blank" rel="noreferrer">
              Download MRN
            </a>
          ) : null}
        </p>
      ) : null}
      {invoice.recycling ? (
        <p className="muted sm">
          Form 6: {invoice.recycling.form6No}{' '}
          <a className="btn bs bsm" href={filesApi.pdf(`/invoices/${invoice.id}/form6.pdf`)} target="_blank" rel="noreferrer">
            Download Form 6
          </a>
        </p>
      ) : null}
      {invoice.certificates.length > 0 ? (
        <p className="muted sm">
          Certificate(s): {invoice.certificates.map((c) => c.certNo).join(', ')}
        </p>
      ) : null}

      {isFactory && stage === 5 && !invoice.mrn ? (
        <MrnForm
          disabled={disabled}
          onSubmit={(body) => onAction(() => lifecycleApi.createMrn(invoice.id, body), 'MRN created.')}
        />
      ) : null}

      {isFactory && stage === 6 && invoice.mrn && !invoice.recycling ? (
        <RecyclingForm
          defaultFactoryId={invoice.mrn.factoryId}
          billingWeight={Number(invoice.billingWeight)}
          disabled={disabled}
          onSubmit={(body) =>
            onAction(() => lifecycleApi.createRecycling(invoice.id, body), 'Recycling recorded.')
          }
        />
      ) : null}

      {isAdmin && stage >= 7 && invoice.recycling && !invoice.closedAt ? (
        <CertificateForm
          disabled={disabled}
          onSubmit={(body) =>
            onAction(() => lifecycleApi.uploadCertificate(invoice.id, body), 'Certificate uploaded.')
          }
        />
      ) : null}

      {isStaff && invoice.recycling ? (
        <SerialPanel invoice={invoice} disabled={disabled} onAction={onAction} />
      ) : null}

      {isStaff && stage >= 5 && !isPaid && !invoice.closedAt ? (
        <PaymentForm
          amountDue={Number(totalPaise - paidPaise) / 100}
          disabled={disabled}
          onSubmit={(body) =>
            onAction(() => lifecycleApi.addPayment(invoice.id, body), 'Payment recorded.')
          }
        />
      ) : null}

      {(isClient || isAdmin) && stage >= 8 && !invoice.closedAt && isPaid && invoice.certificates.length > 0 ? (
        <CloseForm
          disabled={disabled}
          isAdmin={isAdmin}
          onSubmit={(body) =>
            onAction(() => lifecycleApi.closeInvoice(invoice.id, body), 'Invoice closed.')
          }
        />
      ) : null}

      {invoice.closedAt ? (
        <p className="ok-msg sm">Closed {invoice.closedAt.slice(0, 10)}</p>
      ) : null}
    </div>
  );
}

function MrnForm({
  disabled,
  onSubmit,
}: {
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
      <button type="submit" className="btn primary" disabled={disabled}>
        Record goods receipt (MRN)
      </button>
    </form>
  );
}

function RecyclingForm({
  defaultFactoryId,
  billingWeight,
  disabled,
  onSubmit,
}: {
  defaultFactoryId: string;
  billingWeight: number;
  disabled: boolean;
  onSubmit: (body: {
    processedAt: string;
    factoryId?: string;
    categories: Array<{ entryId: string; groupCode: string; weightKg: number }>;
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
      <button type="submit" className="btn primary" disabled={disabled || !selected}>
        Issue Form 6
      </button>
    </form>
  );
}

function CertificateForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (body: { certNo: string; certDate: string; fileId: string; department?: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [certNo, setCertNo] = useState(`URB/COD/${Date.now().toString().slice(-6)}`);
  const [fileId, setFileId] = useState('');

  return (
    <form
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
      <button type="submit" className="btn primary" disabled={disabled || !fileId}>
        Upload &amp; email certificate
      </button>
    </form>
  );
}

function PaymentForm({
  amountDue,
  disabled,
  onSubmit,
}: {
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
      <button type="submit" className="btn primary" disabled={disabled}>
        Record payment
      </button>
    </form>
  );
}

function CloseForm({
  disabled,
  isAdmin,
  onSubmit,
}: {
  disabled: boolean;
  isAdmin: boolean;
  onSubmit: (body: { rating?: number; note?: string; forced?: boolean }) => void;
}) {
  const [rating, setRating] = useState('5');
  const [note, setNote] = useState('');

  return (
    <form
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
      <button type="submit" className="btn primary" disabled={disabled}>
        Acknowledge closure
      </button>
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
  onAction: (fn: () => Promise<unknown>, success: string) => void;
}) {
  const serials = invoice.recycling?.serials ?? [];
  const pending = serials.filter((s) => !s.dcodNo).length;
  const standards = useLookups('destructStd');
  const [std, setStd] = useState('NIST');

  async function onCsv(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const rec = await import('../api').then(({ filesApi }) => filesApi.upload(file, 'serials'));
    const csv = await file.text();
    await onAction(
      () => lifecycleApi.importSerials(invoice.id, { csv, serialFileId: rec.id }),
      `${csv.split(/\n/).length - 1} serials imported.`,
    );
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
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Serial</th>
                <th>Asset</th>
                <th>Item</th>
                <th>DCoD</th>
              </tr>
            </thead>
            <tbody>
              {serials.slice(0, 60).map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.serialNo}</td>
                  <td>{s.assetTag || '—'}</td>
                  <td>{s.make || '—'}</td>
                  <td>{s.dcodNo || <span className="badge bg-am">pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pending > 0 ? (
        <div className="fr2">
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
          <button
            type="button"
            className="btn bp bsm"
            disabled={disabled}
            onClick={() =>
              onAction(
                () => lifecycleApi.destroySerials(invoice.id, { serialNos: 'all', std }),
                'Destruction recorded.',
              )
            }
          >
            Record destruction ({pending})
          </button>
        </div>
      ) : null}
    </div>
  );
}
