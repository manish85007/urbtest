import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { complianceApi, type ControlRow } from '../api';
import { Modal } from '../components/Modal';

type Tab = 'controls' | 'security' | 'access' | 'incidents' | 'privacy' | 'retention' | 'evidence';

const TABS: Array<[Tab, string]> = [
  ['controls', 'Control status'],
  ['security', 'Security events'],
  ['access', 'Access review'],
  ['incidents', 'Incidents'],
  ['privacy', 'Privacy & DSR'],
  ['retention', 'Retention'],
  ['evidence', 'Evidence pack'],
];

function stateBadge(state: string) {
  if (state === 'ok') return <span className="badge bg-g">Operating</span>;
  if (state === 'warn') return <span className="badge bg-am">Needs attention</span>;
  return <span className="badge bg-rd">Not operating</span>;
}

export function CompliancePage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some(([id]) => id === tabParam) ? (tabParam as Tab) : 'controls';
  const [error, setError] = useState('');

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.4rem' }}>
        <div>
          <div className="h1">Compliance</div>
          <div className="dim" style={{ fontSize: '.82rem' }}>
            Controls, registers and evidence for ISO 27001, ISO 9001 and SOC 2 · references shown against each item
          </div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn bsm ${tab === id ? 'bp' : 'bs'}`}
            onClick={() => setParams({ tab: id })}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {tab === 'controls' ? <ControlsTab onError={setError} /> : null}
      {tab === 'security' ? <SecurityTab onError={setError} /> : null}
      {tab === 'access' ? <AccessTab onError={setError} /> : null}
      {tab === 'incidents' ? <IncidentsTab onError={setError} /> : null}
      {tab === 'privacy' ? <PrivacyTab onError={setError} /> : null}
      {tab === 'retention' ? <RetentionTab onError={setError} /> : null}
      {tab === 'evidence' ? <EvidenceTab onError={setError} /> : null}
    </div>
  );
}

function ControlsTab({ onError }: { onError: (s: string) => void }) {
  const [rows, setRows] = useState<ControlRow[]>([]);
  useEffect(() => {
    complianceApi
      .controls()
      .then((r) => setRows(r.controls))
      .catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, [onError]);
  const ok = rows.filter((r) => r.state === 'ok').length;
  const attn = rows.filter((r) => r.state !== 'ok').length;
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Application controls</div>
        <div className="dim">
          {rows.length} tracked · {ok} operating · {attn} need attention
        </div>
      </div>
      <p className="dim" style={{ fontSize: '.8rem', marginBottom: '.7rem' }}>
        These are in-app controls. Organisational ones — policies, training, supplier assessments — live outside the
        tool. See the Compliance Review.
      </p>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Control</th>
              <th>State</th>
              <th>Position</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref}>
                <td className="dim">{r.ref}</td>
                <td>
                  <b>{r.nm}</b>
                </td>
                <td>{stateBadge(r.state)}</td>
                <td>{r.detail}</td>
                <td className="dim">{r.act ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityTab({ onError }: { onError: (s: string) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [severity, setSeverity] = useState('');
  const [rows, setRows] = useState<Array<{ id: string; ts: string; kind: string; email: string; severity: string; detail: unknown }>>([]);
  const [kinds, setKinds] = useState<string[]>([]);

  async function load() {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (kind) qs.set('kind', kind);
    if (severity) qs.set('severity', severity);
    const r = await complianceApi.security(qs.toString() ? `?${qs}` : '');
    setRows(r.rows);
    setKinds(r.kinds);
  }

  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  const high = rows.filter((r) => r.severity === 'high').length;
  const failed = rows.filter((r) => r.kind === 'auth.failed').length;
  const denied = rows.filter((r) => r.kind === 'access.denied').length;

  function exportCsv() {
    const head = ['When', 'Severity', 'Event', 'Account', 'Detail'];
    const body = rows.map((r) =>
      [r.ts, r.severity, r.kind, r.email, JSON.stringify(r.detail)].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
    );
    const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `urbeno-security-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Security events</div>
        <div className="dim">
          {rows.length} events · {high} high · {failed} failed sign-ins · {denied} access denied
        </div>
        <div className="spacer" />
        <button type="button" className="btn bs bsm" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <div className="fr2" style={{ marginBottom: '.6rem' }}>
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Kind</option>
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Severity</option>
          <option value="high">high</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
        </select>
        <button type="button" className="btn bp bsm" onClick={() => load().catch((e) => onError(e.message))}>
          Filter
        </button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Severity</th>
              <th>Event</th>
              <th>Account</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="dim">{r.ts.replace('T', ' ').slice(0, 19)}</td>
                <td>
                  <span className={`badge ${r.severity === 'high' ? 'bg-rd' : r.severity === 'warn' ? 'bg-am' : 'bg-gy'}`}>
                    {r.severity}
                  </span>
                </td>
                <td>{r.kind}</td>
                <td>{r.email}</td>
                <td className="dim" style={{ fontSize: '.78rem' }}>
                  {typeof r.detail === 'object' ? JSON.stringify(r.detail) : String(r.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessTab({ onError }: { onError: (s: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof complianceApi.reviews>> | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    setData(await complianceApi.reviews());
  }
  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, [onError]);

  const open = data?.open;
  const undecided = open?.lines.filter((l) => !l.decision).length ?? 0;

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Access recertification</div>
        <div className="spacer" />
        {!open ? (
          <button
            type="button"
            className="btn bp bsm"
            onClick={() =>
              complianceApi
                .startReview()
                .then(load)
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Start a review
          </button>
        ) : (
          <button
            type="button"
            className="btn bp bsm"
            disabled={undecided > 0}
            onClick={() =>
              complianceApi
                .closeReview(open.id)
                .then(load)
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Complete review
          </button>
        )}
      </div>
      {open ? (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Last sign-in</th>
                <th>Decision</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {open.lines.map((l) => (
                <tr key={l.email}>
                  <td>
                    <b>{l.name}</b>
                    <div className="dim">{l.email}</div>
                  </td>
                  <td>{l.role}</td>
                  <td className="dim">{l.lastLoginAt ? l.lastLoginAt.slice(0, 10) : 'never'}</td>
                  <td>{l.decision ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn bs bsm"
                      onClick={() =>
                        complianceApi.decideReview(open.id, l.email, 'keep').then(load).catch((e) => onError(e.message))
                      }
                    >
                      Confirm
                    </button>{' '}
                    <button type="button" className="btn bs bsm" onClick={() => setNoteFor(l.email)}>
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dim">No review is open. Start one to snapshot every active account.</p>
      )}
      {data?.reviews.filter((r) => r.status === 'closed').length ? (
        <div style={{ marginTop: '1rem' }}>
          <div className="card-ttl">Closed reviews</div>
          <ul>
            {data.reviews
              .filter((r) => r.status === 'closed')
              .map((r) => (
                <li key={r.id}>
                  {r.ref} · closed {r.closedAt?.slice(0, 10)} · {r.lines.length} accounts
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {noteFor && open ? (
        <Modal title="Withdraw access" onClose={() => setNoteFor(null)}>
          <p>Record why this access is being withdrawn.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <button
            type="button"
            className="btn bp"
            onClick={() =>
              complianceApi
                .decideReview(open.id, noteFor, 'revoke', note)
                .then(() => {
                  setNoteFor(null);
                  setNote('');
                  return load();
                })
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Withdraw
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function IncidentsTab({ onError }: { onError: (s: string) => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof complianceApi.incidents>>['incidents']>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof rows)[0] | null>(null);
  const [form, setForm] = useState({
    title: '',
    detectedAt: new Date().toISOString().slice(0, 10),
    severity: 'medium',
    status: 'open',
    description: '',
    reportable: false,
    rootCause: '',
    action: '',
  });

  async function load() {
    setRows((await complianceApi.incidents()).incidents);
  }
  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, [onError]);

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">Incidents</div>
        <div className="spacer" />
        <button type="button" className="btn bp bsm" onClick={() => { setEditing(null); setOpen(true); }}>
          + Record an incident
        </button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Detected</th>
              <th>Status</th>
              <th>Reportable</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.ref}</td>
                <td>{r.title}</td>
                <td>{r.severity}</td>
                <td>{String(r.detectedAt).slice(0, 10)}</td>
                <td>{r.status}</td>
                <td>{r.reportable ? 'Yes' : 'No'}</td>
                <td>
                  <button
                    type="button"
                    className="btn bs bsm"
                    onClick={() => {
                      setEditing(r);
                      setForm({
                        title: r.title,
                        detectedAt: String(r.detectedAt).slice(0, 10),
                        severity: r.severity,
                        status: r.status,
                        description: r.description,
                        reportable: r.reportable,
                        rootCause: r.rootCause,
                        action: r.action,
                      });
                      setOpen(true);
                    }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal title={editing ? editing.ref : 'Record an incident'} onClose={() => setOpen(false)}>
          <div className="fg">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="fr2">
            <div className="fg">
              <label>Detected on</label>
              <input type="date" value={form.detectedAt} onChange={(e) => setForm({ ...form, detectedAt: e.target.value })} />
            </div>
            <div className="fg">
              <label>Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option>low</option>
                <option>medium</option>
                <option>high</option>
              </select>
            </div>
            <div className="fg">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>open</option>
                <option>contained</option>
                <option>closed</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label>What happened</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <label className="dim">
            <input
              type="checkbox"
              checked={form.reportable}
              onChange={(e) => setForm({ ...form, reportable: e.target.checked })}
            />{' '}
            Reportable to the Data Protection Board or a client under DPDPA
          </label>
          <div className="fg">
            <label>Root cause</label>
            <textarea value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} rows={2} />
          </div>
          <div className="fg">
            <label>Corrective action</label>
            <textarea value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} rows={2} />
          </div>
          <button
            type="button"
            className="btn bp"
            onClick={() => {
              const run = editing
                ? complianceApi.updateIncident(editing.id, form)
                : complianceApi.raiseIncident(form);
              run
                .then(() => {
                  setOpen(false);
                  return load();
                })
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
            }}
          >
            Save
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function PrivacyTab({ onError }: { onError: (s: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof complianceApi.privacy>> | null>(null);
  const [lookup, setLookup] = useState('');
  const [subject, setSubject] = useState<Awaited<ReturnType<typeof complianceApi.subject>> | null>(null);
  const [dsr, setDsr] = useState({ kind: 'access', subject: '', note: '' });
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');

  async function load() {
    setData(await complianceApi.privacy());
  }
  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, [onError]);

  return (
    <div>
      <div className="card">
        <div className="card-ttl">Privacy notice</div>
        <p className="dim">
          Version {data?.version ?? '—'} · {data?.accepted ?? 0} accepted · {data?.notAccepted ?? 0} not yet accepted ·{' '}
          {data?.openRequests ?? 0} open requests
        </p>
      </div>
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Data subject requests</div>
        </div>
        <div className="fr2">
          <select value={dsr.kind} onChange={(e) => setDsr({ ...dsr, kind: e.target.value })}>
            <option>access</option>
            <option>correction</option>
            <option>erasure</option>
            <option>withdrawal of consent</option>
            <option>grievance</option>
          </select>
          <input
            placeholder="Subject email"
            value={dsr.subject}
            onChange={(e) => setDsr({ ...dsr, subject: e.target.value })}
          />
          <button
            type="button"
            className="btn bp bsm"
            onClick={() =>
              complianceApi
                .raiseDsr(dsr)
                .then(load)
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            + Log a request
          </button>
        </div>
        <div className="tw" style={{ marginTop: '.7rem' }}>
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Kind</th>
                <th>Subject</th>
                <th>Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.dsrs ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{d.ref}</td>
                  <td>{d.kind}</td>
                  <td>{d.subject}</td>
                  <td>{String(d.due).slice(0, 10)}</td>
                  <td>{d.status}</td>
                  <td>
                    {d.status === 'open' ? (
                      <button type="button" className="btn bs bsm" onClick={() => setOutcomeFor(d.id)}>
                        Close
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-ttl">Subject-access lookup</div>
        <div className="fr2">
          <input placeholder="email" value={lookup} onChange={(e) => setLookup(e.target.value)} />
          <button
            type="button"
            className="btn bp bsm"
            onClick={() =>
              complianceApi
                .subject(lookup)
                .then(setSubject)
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Look up
          </button>
        </div>
        {subject ? (
          <div style={{ marginTop: '.7rem' }}>
            <p>
              {subject.found ? 'Record found' : 'No account'} for {subject.email}
            </p>
            <div className="tw">
              <table>
                <tbody>
                  {Object.entries(subject.summary).map(([k, v]) => (
                    <tr key={k}>
                      <td className="dim">{k}</td>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn bs bsm"
              onClick={() => {
                const blob = new Blob([JSON.stringify(subject, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `subject-${subject.email}.json`;
                a.click();
              }}
            >
              Export as JSON
            </button>
          </div>
        ) : null}
      </div>
      {outcomeFor ? (
        <Modal title="Close request" onClose={() => setOutcomeFor(null)}>
          <p>Record what was done to answer this request.</p>
          <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} />
          <button
            type="button"
            className="btn bp"
            onClick={() =>
              complianceApi
                .closeDsr(outcomeFor, outcome)
                .then(() => {
                  setOutcomeFor(null);
                  setOutcome('');
                  return load();
                })
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Close
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function RetentionTab({ onError }: { onError: (s: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof complianceApi.retention>> | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: '', describes: '', method: 'Secure deletion', approvedBy: '', note: '' });

  async function load() {
    setData(await complianceApi.retention());
  }
  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : 'Failed'));
  }, [onError]);

  const due = data?.register.filter((r) => r.due) ?? [];

  return (
    <div>
      <div className="card">
        <div className="card-ttl">Retention policy</div>
        <p className="dim">
          Compliance records {data?.years.compliance ?? 5} years · certificates {data?.years.certificate ?? 10} · audit{' '}
          {data?.years.audit ?? 7} · personal {data?.years.personal ?? 3} · security {data?.years.security ?? 2}
        </p>
        {due.length ? (
          <p>
            {due.length} record set{due.length > 1 ? 's' : ''} past its date.{' '}
            <button type="button" className="btn bp bsm" onClick={() => setOpen(true)}>
              Record a disposal
            </button>
          </p>
        ) : (
          <button type="button" className="btn bs bsm" onClick={() => setOpen(true)}>
            Record a disposal
          </button>
        )}
      </div>
      <div className="card">
        <div className="card-ttl">Register</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Kind</th>
                <th>Ref</th>
                <th>Held</th>
                <th>Keep (y)</th>
                <th>Due from</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {(data?.register ?? []).slice(0, 200).map((r, i) => (
                <tr key={`${r.kind}-${r.ref}-${i}`}>
                  <td>{r.cls}</td>
                  <td>{r.kind}</td>
                  <td>{r.ref}</td>
                  <td className="dim">{r.held ? r.held.slice(0, 10) : '—'}</td>
                  <td>{r.keep}</td>
                  <td>{r.dueFrom ?? '—'}</td>
                  <td>{r.due ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-ttl">Disposals</div>
        <ul>
          {(data?.disposals ?? []).map((d) => (
            <li key={d.id}>
              {d.ref} · {d.kind} · {d.method} · {d.at.slice(0, 10)} · {d.by}
            </li>
          ))}
        </ul>
      </div>
      {open ? (
        <Modal title="Record a disposal" onClose={() => setOpen(false)}>
          <div className="fg">
            <label>Type</label>
            <input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} />
          </div>
          <div className="fg">
            <label>What was disposed of</label>
            <input value={form.describes} onChange={(e) => setForm({ ...form, describes: e.target.value })} />
          </div>
          <div className="fg">
            <label>Method</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option>Secure deletion</option>
              <option>Cryptographic erasure</option>
              <option>Physical destruction</option>
              <option>Anonymisation</option>
              <option>Archived offline</option>
            </select>
          </div>
          <div className="fg">
            <label>Approved by</label>
            <input value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
          </div>
          <button
            type="button"
            className="btn bp"
            onClick={() =>
              complianceApi
                .dispose(form)
                .then(() => {
                  setOpen(false);
                  return load();
                })
                .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
            }
          >
            Save
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function EvidenceTab({ onError }: { onError: (s: string) => void }) {
  const [chain, setChain] = useState<string>('');
  const pack = useMemo(() => null, []);
  void pack;

  return (
    <div className="card">
      <div className="card-ttl">Evidence pack</div>
      <p className="dim">Export what an auditor samples. The audit chain is verified server-side.</p>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn bp"
          onClick={() =>
            complianceApi
              .evidence()
              .then((p) => {
                const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `urbeno-evidence-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
              })
              .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
          }
        >
          Evidence pack (JSON)
        </button>
        <button
          type="button"
          className="btn bs"
          onClick={() =>
            complianceApi
              .auditChain()
              .then((c) =>
                setChain(
                  c.ok
                    ? `Chain intact · ${c.count} entries · head ${c.head}`
                    : `Broken at ${c.seq}: ${c.reason}`,
                ),
              )
              .catch((e) => onError(e instanceof Error ? e.message : 'Failed'))
          }
        >
          Verify audit chain now
        </button>
      </div>
      {chain ? <p style={{ marginTop: '.8rem' }}>{chain}</p> : null}
    </div>
  );
}
