import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dataApi, lifecycleApi, type SessionUser } from '../api';

export function NewRequestPage({ user }: { user: SessionUser }) {
  const nav = useNavigate();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [clientId, setClientId] = useState(user.clientId ?? '');
  const [siteId, setSiteId] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [approxWeight, setApproxWeight] = useState('');
  const [approxQty, setApproxQty] = useState('');
  const [notes, setNotes] = useState('');
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
      <p className="muted">Stage 1 — raise a request for e-waste collection.</p>

      <form className="card form-grid" onSubmit={submit}>
        {user.role !== 'client' ? (
          <label>
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Site
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            <option value="">Select site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Request date
          <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
        </label>

        <label>
          Pickup location
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Building / floor / bay" />
        </label>

        <div className="fr2">
          <label>
            Approx. weight (kg)
            <input type="number" min="0" step="0.001" value={approxWeight} onChange={(e) => setApproxWeight(e.target.value)} />
          </label>
          <label>
            Approx. quantity
            <input type="number" min="0" value={approxQty} onChange={(e) => setApproxQty(e.target.value)} />
          </label>
        </div>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

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
