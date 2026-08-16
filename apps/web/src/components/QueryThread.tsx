import { useRef, useState } from 'react';
import { lifecycleApi, type QueryThread as QueryThreadType, type SessionUser } from '../api';
import { fmtDate } from '../lib/format';

export function QueryThread({
  submissionId,
  queries,
  user,
  disabled,
  onAction,
}: {
  submissionId: string;
  queries: QueryThreadType[];
  user: SessionUser;
  disabled: boolean;
  onAction: (fn: () => Promise<unknown>, success: string) => void;
}) {
  const [text, setText] = useState('');
  const [openCompose, setOpenCompose] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const openCount = queries.filter((q) => q.status === 'open').length;

  function startCompose() {
    setOpenCompose(true);
    setTimeout(() => composeRef.current?.focus(), 0);
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">
          Queries {openCount ? <span className="badge bg-rd">{openCount} open</span> : null}
        </div>
        <div className="spacer" />
        <button type="button" className="btn bs bsm" onClick={startCompose}>
          + Raise
        </button>
      </div>
      {!queries.length ? (
        <div className="dim" style={{ fontSize: '.82rem', textAlign: 'center', padding: '.6rem 0' }}>
          No queries
        </div>
      ) : (
        queries.map((q) => {
          const canReply =
            q.status === 'open' &&
            ((q.fromRole === 'client' && isStaff) || (q.fromRole === 'admin' && user.role === 'client'));
          return (
            <div
              key={q.id}
              style={{
                border: '1px solid var(--bd)',
                borderRadius: 8,
                padding: '.5rem',
                marginBottom: '.4rem',
                background: q.status === 'open' ? 'var(--am2)' : 'var(--g5)',
              }}
            >
              <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center', marginBottom: '.25rem', flexWrap: 'wrap' }}>
                <span className={`badge ${q.fromRole === 'client' ? 'bg-bl' : 'bg-g'}`}>
                  {q.fromRole === 'client' ? 'Client' : 'Urbeno'}
                </span>
                <b style={{ fontSize: '.8rem' }}>{q.authorName}</b>
                <span className="dim" style={{ fontSize: '.7rem' }}>
                  {fmtDate(q.createdAt)}
                </span>
                <div className="spacer" />
                <span className={`badge ${q.status === 'open' ? 'bg-am' : 'bg-g'}`}>{q.status}</span>
              </div>
              <div style={{ fontSize: '.84rem' }}>{q.text}</div>
              {q.replies.map((r) => (
                <div
                  key={r.id}
                  style={{ marginTop: '.4rem', paddingTop: '.35rem', borderTop: '1px solid var(--bd)', fontSize: '.82rem' }}
                >
                  <b>{r.authorName}:</b> {r.text}
                  <div className="dim" style={{ fontSize: '.7rem' }}>
                    {fmtDate(r.createdAt)}
                  </div>
                </div>
              ))}
              {canReply && replyFor !== q.id ? (
                <button type="button" className="btn bs bsm" style={{ marginTop: '.35rem' }} onClick={() => setReplyFor(q.id)}>
                  Reply
                </button>
              ) : null}
              {replyFor === q.id ? (
                <form
                  className="sub-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAction(() => lifecycleApi.replyQuery(q.id, reply), 'Reply sent');
                    setReply('');
                    setReplyFor(null);
                  }}
                >
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} required rows={3} />
                  <button type="submit" className="btn bp bsm" disabled={disabled}>
                    Send Reply
                  </button>
                </form>
              ) : null}
            </div>
          );
        })
      )}
      {openCompose ? (
        <form
          className="sub-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(() => lifecycleApi.raiseQuery(submissionId, text), 'Query sent');
            setText('');
            setOpenCompose(false);
          }}
        >
          <label>
            Raise a query
            <textarea
              ref={composeRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would you like to ask?"
              rows={3}
              required
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setOpenCompose(false)}>
              Cancel
            </button>
            <button type="submit" className="btn bs bsm" disabled={disabled}>
              + Raise
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
