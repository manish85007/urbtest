import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataApi, filesApi, lifecycleApi, type SessionUser } from '../api';
import { FileThumb } from '../components/FileThumb';
import { EMPTY_LINE, LineItemsEditor, namedDraftLines, type DraftLine } from '../components/LineItemsEditor';
import { Modal } from '../components/Modal';

const BOM_MAX_MB = 10;

export function NewRequestPage({ user }: { user: SessionUser }) {
  const nav = useNavigate();
  const bomInput = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [clientId, setClientId] = useState(user.clientId ?? '');
  const [siteId, setSiteId] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [ref, setRef] = useState('');
  const [approxWeight, setApproxWeight] = useState('');
  const [approxQty, setApproxQty] = useState('');
  const [qtyTouched, setQtyTouched] = useState(false);
  const [wtTouched, setWtTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [bom, setBom] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dataApi
      .clients()
      .then((list) => {
        setClients(list);
        if (!user.clientId && list[0]) setClientId((cur) => cur || list[0].id);
      })
      .catch(() => setError('Could not load clients'));
  }, [user.clientId]);

  useEffect(() => {
    if (!clientId) return;
    dataApi.sites(clientId).then((s) => {
      setSites(s);
      setSiteId(s[0]?.id ?? '');
    });
  }, [clientId]);

  useEffect(() => {
    if (user.clientId) setClientId(user.clientId);
  }, [user.clientId]);

  useEffect(() => {
    const q = items.reduce((sum, row) => sum + (parseInt(row.q, 10) || 0), 0);
    const w = items.reduce((sum, row) => sum + (parseFloat(row.w) || 0), 0);
    if (q && !qtyTouched) setApproxQty(String(q));
    if (w && !wtTouched) setApproxWeight(w.toFixed(1));
  }, [items, qtyTouched, wtTouched]);

  async function onBom(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError('');
    try {
      const rec = await filesApi.upload(file, 'bom');
      setBom({ id: rec.id, name: rec.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach BoM');
    } finally {
      if (bomInput.current) bomInput.current.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const named = namedDraftLines(items);
    if (!siteId || !location.trim() || !requestDate || !Number(approxQty) || !Number(approxWeight)) {
      setError('Site, location, date, approximate quantity and weight are all required.');
      return;
    }
    if (!named.length && !bom) {
      setError('Add at least one line item, or attach a bill of materials.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sub = await lifecycleApi.createSubmission({
        clientId,
        siteId,
        requestDate,
        location: location.trim(),
        approxWeight: Number(approxWeight),
        approxQty: Number(approxQty),
        notes: notes.trim() || undefined,
        ref: ref.trim() || undefined,
        bomFileId: bom?.id,
        items: named,
      });
      nav(`/requests/${sub.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New Collection Request"
      heading
      wide
      onClose={() => nav('/requests')}
      okLabel={busy ? 'Submitting…' : 'Submit Request'}
      form="new-request-form"
      busy={busy}
    >
      <p className="dim" style={{ fontSize: '.83rem', marginBottom: '.8rem' }}>
        Give us an approximate quantity and weight — exact figures are captured at weighment. Attach a
        bill of materials if you have a detailed line list.
      </p>
      <form id="new-request-form" className="sub-form" onSubmit={submit}>
        {user.role !== 'client' ? (
          <div className="fg">
            <label htmlFor="ns-cid">Client *</label>
            <select id="ns-cid" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="fr2">
          <div className="fg">
            <label htmlFor="ns-site">Site *</label>
            <select id="ns-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              {sites.length ? (
                sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              ) : (
                <option value="">No sites configured</option>
              )}
            </select>
          </div>
          <div className="fg">
            <label htmlFor="ns-loc">Pickup Location *</label>
            <input
              id="ns-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Building / floor / warehouse"
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="ns-ref">Your PO / Reference</label>
            <input id="ns-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PO-1234" />
          </div>
          <div className="fg">
            <label htmlFor="ns-date">Request Date *</label>
            <input
              id="ns-date"
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="ns-qty">Approx. Quantity (units) *</label>
            <input
              id="ns-qty"
              type="number"
              min="1"
              value={approxQty}
              placeholder="e.g. 45"
              onChange={(e) => {
                setQtyTouched(true);
                setApproxQty(e.target.value);
              }}
              required
            />
          </div>
          <div className="fg">
            <label htmlFor="ns-wt">Approx. Weight (kg) *</label>
            <input
              id="ns-wt"
              type="number"
              min="0.1"
              step="0.1"
              value={approxWeight}
              placeholder="e.g. 150"
              onChange={(e) => {
                setWtTouched(true);
                setApproxWeight(e.target.value);
              }}
              required
            />
          </div>
        </div>

        <div className="fg">
          <label htmlFor="ns-notes">
            Notes <span className="hint">anything our team should know</span>
          </label>
          <textarea
            id="ns-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Access constraints, preferred pickup window, contact on site…"
            style={{ minHeight: 52 }}
          />
        </div>

        <div className="section-hd" style={{ marginTop: '.5rem' }}>
          Bill of Materials{' '}
          <span className="hint" style={{ fontWeight: 400 }}>
            optional — CSV, Excel or PDF up to {BOM_MAX_MB} MB
          </span>
        </div>
        {bom ? (
          <div className="frow">
            <FileThumb id={bom.id} kind="doc" name={bom.name} />
            <button type="button" className="btn brd bsm" onClick={() => setBom(null)}>
              ×
            </button>
          </div>
        ) : null}
        <label className="btn bs bsm" style={{ cursor: 'pointer' }}>
          📤 Attach BoM
          <input
            ref={bomInput}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => void onBom(e.target.files)}
          />
        </label>

        <LineItemsEditor items={items} onChange={setItems} hint="optional if BoM attached" />

        {error ? <p className="error">{error}</p> : null}
      </form>
    </Modal>
  );
}
