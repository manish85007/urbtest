import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dataApi, lifecycleApi, type SessionUser } from '../api';
import { FileUpload } from '../components/FileUpload';

export function NewRequestPage({ user }: { user: SessionUser }) {
  const nav = useNavigate();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [clientId, setClientId] = useState(user.clientId ?? '');
  const [siteId, setSiteId] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [ref, setRef] = useState('');
  const [approxWeight, setApproxWeight] = useState('');
  const [approxQty, setApproxQty] = useState('');
  const [notes, setNotes] = useState('');
  const [bomFileId, setBomFileId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dataApi.clients().then(setClients).catch(() => setError('Could not load clients'));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    dataApi.sites(clientId).then((s) => {
      setSites(s);
      if (s.length === 1) setSiteId(s[0].id);
    });
  }, [clientId]);

  useEffect(() => {
    if (user.clientId) setClientId(user.clientId);
  }, [user.clientId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const sub = await lifecycleApi.createSubmission({
        clientId,
        siteId,
        requestDate,
        location: location || undefined,
        approxWeight: approxWeight ? Number(approxWeight) : undefined,
        approxQty: approxQty ? Number(approxQty) : undefined,
        notes: notes || undefined,
        ref: ref || undefined,
        bomFileId: bomFileId || undefined,
      });
      nav(`/requests/${sub.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="h1">New pickup request</h1>
      <p className="muted">
        Give us an approximate quantity and weight — exact figures are captured at weighment. Attach a
        bill of materials if you have a detailed line list.
      </p>

      <form className="card form-grid" onSubmit={submit}>
        {user.role !== 'client' ? (
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="fr2">
          <label>
            Site
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pickup location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Building / floor / warehouse"
            />
          </label>
          <label>
            Your PO / Reference
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PO-1234" />
          </label>
          <label>
            Request date
            <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
          </label>
          <label>
            Approx. quantity
            <input
              type="number"
              min="0"
              value={approxQty}
              onChange={(e) => setApproxQty(e.target.value)}
              placeholder="e.g. 45"
            />
          </label>
          <label>
            Approx. weight (kg)
            <input
              type="number"
              min="0"
              step="0.001"
              value={approxWeight}
              onChange={(e) => setApproxWeight(e.target.value)}
              placeholder="e.g. 150"
            />
          </label>
        </div>

        <label>
          Notes <span className="hint">anything our team should know</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Access constraints, preferred pickup window, contact on site…"
          />
        </label>

        <div className="section-hd">Bill of Materials</div>
        <FileUpload
          kind="bom"
          label="Bill of materials"
          hint="Optional — CSV, Excel or PDF listing line items"
          accept=".csv,.xls,.xlsx,application/pdf,text/csv"
          disabled={busy}
          value={bomFileId ? [bomFileId] : []}
          onChange={(ids) => setBomFileId(ids[0] ?? '')}
        />

        {error ? <p className="error">{error}</p> : null}

        <div className="form-actions">
          <Link to="/" className="btn ghost">
            Cancel
          </Link>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}
