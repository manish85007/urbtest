import type { SubmissionLifecycleEvent } from '../api';
import { fmtDate, fmtTS } from '../lib/format';

const EVENT_META: Record<string, { icon: string; tone: string }> = {
  created: { icon: '📝', tone: 'var(--bl)' },
  returned: { icon: '↩️', tone: 'var(--rd)' },
  resubmitted: { icon: '✉️', tone: 'var(--g)' },
  acknowledged: { icon: '✅', tone: 'var(--g)' },
  loading_complete: { icon: '📦', tone: 'var(--bl)' },
};

function eventLabel(event: string): string {
  switch (event) {
    case 'created':
      return 'Request raised';
    case 'returned':
      return 'Returned to requestor';
    case 'resubmitted':
      return 'Requestor resubmitted';
    case 'acknowledged':
      return 'Acknowledged by Urbeno';
    case 'loading_complete':
      return 'Loading complete';
    default:
      return event;
  }
}

export function RequestLifecycleCard({ events }: { events: SubmissionLifecycleEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Request lifecycle</div>
      </div>
      <div className="dim" style={{ fontSize: '.76rem', marginBottom: '.55rem' }}>
        Return, resubmit, and acknowledgement activity for this request.
      </div>
      <div style={{ display: 'grid', gap: '.55rem' }}>
        {events.map((ev) => {
          const meta = EVENT_META[ev.event] ?? { icon: '•', tone: 'var(--g2)' };
          const changes = Array.isArray(ev.details?.changes) ? (ev.details!.changes as string[]) : [];
          return (
            <div
              key={ev.id}
              style={{
                borderLeft: `3px solid ${meta.tone}`,
                padding: '.45rem .55rem .45rem .7rem',
                background: 'var(--g5)',
                borderRadius: '0 8px 8px 0',
              }}
            >
              <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{meta.icon}</span>
                <b style={{ fontSize: '.8rem' }}>{eventLabel(ev.event)}</b>
                <span className="dim" style={{ fontSize: '.72rem' }}>
                  {fmtTS(ev.createdAt)}
                </span>
              </div>
              <div style={{ fontSize: '.84rem', marginTop: '.25rem', whiteSpace: 'pre-wrap' }}>{ev.summary}</div>
              <div className="dim" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>
                {ev.actorEmail}
              </div>
              {changes.length ? (
                <ul style={{ margin: '.35rem 0 0 1rem', fontSize: '.78rem', color: 'var(--g1)' }}>
                  {changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {ev.event === 'returned' && typeof ev.details?.reason === 'string' ? (
                <div className="dim" style={{ fontSize: '.74rem', marginTop: '.25rem' }}>
                  Sent {fmtDate(ev.createdAt)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
