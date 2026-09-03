import { useEffect, useState } from 'react';
import { announcementsApi, type AnnouncementRow } from '../../api';

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnnouncementsTab() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Form state
  const [message, setMessage] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    announcementsApi
      .list()
      .then(setRows)
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !startsAt || !endsAt) return;
    setSaving(true);
    setError('');
    try {
      await announcementsApi.create({ message, startsAt, endsAt, sendEmail });
      setFlash(sendEmail ? 'Announcement created and emails queued.' : 'Announcement created.');
      setMessage('');
      setStartsAt('');
      setEndsAt('');
      setSendEmail(false);
      load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return;
    try {
      await announcementsApi.remove(id);
      setRows((r) => r.filter((a) => a.id !== id));
    } catch {
      setError('Failed to delete');
    }
  }

  const now = new Date();
  const isActive = (a: AnnouncementRow) =>
    new Date(a.startsAt) <= now && new Date(a.endsAt) >= now;

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.1rem' }}>
        Maintenance Announcements
      </h2>

      {flash && (
        <div className="alert ok" style={{ marginBottom: '1rem' }}>
          {flash}
        </div>
      )}
      {error && (
        <div className="alert err" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Create form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-ttl" style={{ marginBottom: '.75rem' }}>
          New Announcement
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          <div>
            <label className="lbl">Message (shown as scrolling banner)</label>
            <textarea
              className="inp"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Scheduled maintenance on 5 Sep 2026 from 11 PM to 2 AM IST. Portal may be intermittently unavailable."
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
            <div>
              <label className="lbl">Start date/time</label>
              <input
                type="datetime-local"
                className="inp"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">End date/time</label>
              <input
                type="datetime-local"
                className="inp"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Also send email notification to all client users
          </label>
          <div>
            <button type="submit" className="btn bp" disabled={saving}>
              {saving ? 'Saving…' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="card">
        <div className="card-ttl" style={{ marginBottom: '.75rem' }}>
          All Announcements
        </div>
        {loading ? (
          <p className="dim" style={{ fontSize: '.88rem' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="dim" style={{ fontSize: '.88rem' }}>No announcements yet.</p>
        ) : (
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Message</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Status</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={{ maxWidth: 320, wordBreak: 'break-word' }}>{a.message}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.82rem' }}>{fmtDt(a.startsAt)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.82rem' }}>{fmtDt(a.endsAt)}</td>
                  <td>
                    {isActive(a) ? (
                      <span className="ok-mark">● Live</span>
                    ) : new Date(a.endsAt) < now ? (
                      <span className="dim">Expired</span>
                    ) : (
                      <span className="warn">Scheduled</span>
                    )}
                  </td>
                  <td>{a.emailSent ? <span className="ok-mark">Sent</span> : <span className="dim">—</span>}</td>
                  <td>
                    <button
                      type="button"
                      className="btn bs bsm"
                      style={{ color: 'var(--rd)' }}
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
