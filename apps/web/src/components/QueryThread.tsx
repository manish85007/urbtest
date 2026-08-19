import { useState } from 'react';
import { lifecycleApi, type QueryThread as QueryThreadType, type SessionUser } from '../api';
import { fmtDate } from '../lib/format';
import { Modal } from './Modal';

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
  onAction: (fn: () => Promise<unknown>, success: string) => Promise<boolean> | boolean | void;
}) {
  const [text, setText] = useState('');
  const [openCompose, setOpenCompose] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const isStaff = user.role === 'admin' || user.role === 'factory';
  const openCount = queries.filter((q) => q.status === 'open').length;
  const replyTarget = queries.find((q) => q.id === replyFor);

  async function sendQuery() {
    const ok = await onAction(() => lifecycleApi.raiseQuery(submissionId, text), 'Query sent');
    if (ok !== false) {
      setText('');
      setOpenCompose(false);
    }
  }

  async function sendReply() {
    if (!replyFor) return;
    const ok = await onAction(() => lifecycleApi.replyQuery(replyFor, reply), 'Reply sent');
    if (ok !== false) {
      setReply('');
      setReplyFor(null);
    }
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">
          Queries {openCount ? <span className="badge bg-rd">{openCount} open</span> : null}
        </div>
        <div className="spacer" />
        {disabled ? null : (
          <button type="button" className="btn bs bsm" onClick={() => setOpenCompose(true)}>
            + Raise
          </button>
        )}
      </div>
      {!queries.length ? (
        <div className="dim" style={{ fontSize: '.82rem', textAlign: 'center', padding: '.6rem 0' }}>
          No queries
        </div>
      ) : (
        queries.map((q) => {
          const canReply =
            !disabled &&
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
              {canReply ? (
                <button type="button" className="btn bs bsm" style={{ marginTop: '.35rem' }} onClick={() => setReplyFor(q.id)}>
                  Reply
                </button>
              ) : null}
            </div>
          );
        })
      )}

      {openCompose ? (
        <Modal
          title="Raise a Query"
          onClose={() => setOpenCompose(false)}
          okLabel="Send"
          form="query-form"
          busy={disabled}
        >
          <form
            id="query-form"
            className="sub-form"
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuery();
            }}
          >
            <label>
              Your question or note
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would you like to ask?"
                rows={4}
                required
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {replyTarget ? (
        <Modal
          title="Reply to Query"
          onClose={() => setReplyFor(null)}
          okLabel="Send Reply"
          form="reply-form"
          busy={disabled}
        >
          <div className="card" style={{ background: 'var(--g5)', marginBottom: '.6rem' }}>
            <b style={{ fontSize: '.82rem' }}>{replyTarget.authorName}</b>
            <div style={{ fontSize: '.85rem', marginTop: '.2rem' }}>{replyTarget.text}</div>
          </div>
          <form
            id="reply-form"
            className="sub-form"
            onSubmit={(e) => {
              e.preventDefault();
              void sendReply();
            }}
          >
            <label>
              Your reply
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} required />
            </label>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
