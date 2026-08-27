import { useEffect, useState } from 'react';
import { mergeTemplate } from '@urb-tectrack/shared';
import { adminApi, emailsApi } from '../../api';
import { Modal } from '../../components/Modal';

const SAMPLE_VARS: Record<string, string> = {
  request_id: 'REQ-00042',
  request_date: '04 Nov 2025',
  site_name: 'Bengaluru HQ',
  location: 'Tower B',
  approx_weight: '240',
  approx_qty: '111',
  contact_name: 'Ramesh Kumar',
  client_name: 'TechCorp Solutions Pvt Ltd',
  invoice_no: 'TC-INV-0198',
  cert_no: 'URB/COD/2526/0117',
  cert_date: '22 Nov 2025',
  net_weight: '234',
  user_name: 'Ramesh Kumar',
  user_email: 'ramesh@techcorp.in',
  code: '482913',
  expiry_minutes: '15',
  support_email: 'info@urbeno.in',
  contact_email: 'info@urbeno.in',
  temp_password: 'demo',
  admin_name: 'Urbeno Admin',
  portal_url: 'https://tectrack.urbeno.in',
};

const TXN_WHEN: Record<string, string> = {
  request_ack: 'when a request is acknowledged',
  request_new_admin: 'when a new request is raised',
  cod_delivery: 'when a certificate is uploaded',
  password_reset: 'on password reset request',
  user_welcome: 'when a user is created',
  payment_reminder: 'when an invoice term elapses',
  sla_alert: 'when recycling SLA is at risk',
  capacity_alert: 'when a category crosses 80% or 100%',
};

type Template = {
  id: string;
  key: string | null;
  name: string;
  subject: string;
  body: string;
  editable: boolean;
  variables?: string[];
};

type OutboxRow = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  to: string[];
  body?: string;
  templateKey?: string;
  templateName?: string | null;
};

interface EmailTabProps {
  templates: Template[];
  outbox: OutboxRow[];
  onChanged: (msg: string) => void;
}

export function EmailTab({ templates, outbox, onChanged }: EmailTabProps) {
  const [emTab, setEmTab] = useState<'templates' | 'outbox' | 'smtp'>('templates');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<Template | null>(null);
  const [edit, setEdit] = useState<Template | null | 'new'>(null);
  const [send, setSend] = useState<Template | null>(null);
  const [view, setView] = useState<OutboxRow | null>(null);

  const txn = templates.filter((t) => !t.editable);
  const custom = templates.filter((t) => t.editable);
  const filtered = outbox.filter((e) => {
    if (!q.trim()) return true;
    const hay = `${e.subject} ${e.to.join(' ')} ${e.templateName ?? ''}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <>
      <div className="f-row" style={{ margin: '.2rem 0 .7rem' }}>
        <div style={{ fontSize: '.85rem', color: 'var(--mu)', maxWidth: 640 }}>
          Transactional templates fire automatically on system events and are locked so automated
          messages stay consistent. Custom templates are yours to edit and send.
        </div>
        <div className="spacer" />
        {emTab === 'templates' ? (
          <button type="button" className="btn bp bsm" onClick={() => setEdit('new')}>
            + New Template
          </button>
        ) : null}
      </div>
      <div className="card" style={{ padding: '.4rem' }}>
        <div style={{ display: 'flex', gap: '.2rem', padding: '0 .2rem', borderBottom: '1px solid var(--bd)' }}>
          <button type="button" className={`inv-tab ${emTab === 'templates' ? 'on' : ''}`} onClick={() => setEmTab('templates')}>
            Templates
          </button>
          <button type="button" className={`inv-tab ${emTab === 'outbox' ? 'on' : ''}`} onClick={() => setEmTab('outbox')}>
            Outbox
          </button>
          <button type="button" className={`inv-tab ${emTab === 'smtp' ? 'on' : ''}`} onClick={() => setEmTab('smtp')}>
            Outgoing mail
          </button>
        </div>
        <div style={{ padding: '.7rem .3rem 0' }}>
          {emTab === 'templates' ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)', marginBottom: '.4rem' }}>
                Fixed transactional ({txn.length})
              </div>
              {txn.map((t) => (
                <TemplateCard key={t.key ?? t.id} t={t} onPreview={setPreview} onEdit={setEdit} onSend={setSend} />
              ))}
              <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)', margin: '.8rem 0 .4rem' }}>
                Custom — editable and sendable ({custom.length})
              </div>
              {custom.length ? (
                custom.map((t) => (
                  <TemplateCard key={t.key ?? t.id} t={t} onPreview={setPreview} onEdit={setEdit} onSend={setSend} />
                ))
              ) : (
                <div className="dim" style={{ fontSize: '.84rem' }}>
                  None yet
                </div>
              )}
            </>
          ) : emTab === 'outbox' ? (
            <>
              <label style={{ maxWidth: 340 }}>
                Search sent mail
                <input value={q} placeholder="subject, recipient, template…" onChange={(e) => setQ(e.target.value)} />
              </label>
              {!filtered.length ? (
                <div className="dim" style={{ fontSize: '.84rem' }}>
                  Nothing sent yet
                </div>
              ) : (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Sent</th>
                        <th>To</th>
                        <th>Subject</th>
                        <th>Template</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 120).map((e) => (
                        <tr key={e.id}>
                          <td className="dim">{(e.sentAt || e.createdAt).slice(0, 19).replace('T', ' ')}</td>
                          <td style={{ fontSize: '.8rem' }}>{e.to.join(', ')}</td>
                          <td>{e.subject}</td>
                          <td className="dim">{e.templateName || e.templateKey || '—'}</td>
                          <td>
                            <span className="badge">{e.status}</span>
                          </td>
                          <td>
                            <button type="button" className="btn bs bsm" onClick={() => setView(e)}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <SmtpSettingsForm onChanged={onChanged} />
          )}
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn bs" onClick={() => void onChangedJob(() => adminApi.runEmailQueue(), 'Email queue processed.', onChanged)}>
          Process email queue
        </button>
        <button type="button" className="btn bs" onClick={() => void onChangedJob(() => adminApi.runReminders(), 'Reminders + email queue run.', onChanged)}>
          Run reminders job
        </button>
      </div>
      {preview ? (
        <Modal title={`Preview — ${preview.name}`} onClose={() => setPreview(null)} wide>
          <div className="tile" style={{ marginBottom: '.6rem' }}>
            <div className="tile-l">Subject</div>
            <div className="tile-v">{mergeTemplate(preview.subject, SAMPLE_VARS)}</div>
          </div>
          <div className="tpl-preview">{mergeTemplate(preview.body, SAMPLE_VARS)}</div>
        </Modal>
      ) : null}
      {edit ? (
        <TemplateEditModal
          template={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={(msg) => {
            setEdit(null);
            onChanged(msg);
          }}
        />
      ) : null}
      {send ? (
        <SendModal
          template={send}
          onClose={() => setSend(null)}
          onSaved={(msg) => {
            setSend(null);
            onChanged(msg);
          }}
        />
      ) : null}
      {view ? (
        <Modal title={view.subject} onClose={() => setView(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '.4rem', marginBottom: '.7rem' }}>
            <div className="tile">
              <div className="tile-l">To</div>
              <div className="tile-v" style={{ fontSize: '.8rem' }}>
                {view.to.join(', ')}
              </div>
            </div>
            <div className="tile">
              <div className="tile-l">Sent</div>
              <div className="tile-v">{(view.sentAt || view.createdAt).slice(0, 19).replace('T', ' ')}</div>
            </div>
            <div className="tile">
              <div className="tile-l">Template</div>
              <div className="tile-v">{view.templateName || view.templateKey || '—'}</div>
            </div>
          </div>
          <div className="tpl-preview">{view.body || '—'}</div>
        </Modal>
      ) : null}
    </>
  );
}

function TemplateCard({
  t,
  onPreview,
  onEdit,
  onSend,
}: {
  t: Template;
  onPreview: (t: Template) => void;
  onEdit: (t: Template) => void;
  onSend: (t: Template) => void;
}) {
  return (
    <div className="sub-card">
      <div className="sub-card-hd">
        <b style={{ fontSize: '.9rem' }}>{t.name}</b>
        <span className={`badge ${t.editable ? 'bg-bl' : 'bg-gy'}`}>{t.editable ? 'Editable' : 'Fixed'}</span>
        <div className="spacer" />
        <button type="button" className="btn bs bsm" onClick={() => onPreview(t)}>
          Preview
        </button>
        {t.editable && t.key ? (
          <>
            <button type="button" className="btn bs bsm" onClick={() => onEdit(t)}>
              Edit
            </button>
            <button type="button" className="btn bp bsm" onClick={() => onSend(t)}>
              Send
            </button>
          </>
        ) : null}
      </div>
      <div style={{ fontSize: '.82rem', color: 'var(--g2)', marginBottom: '.25rem' }}>
        <b>Subject:</b> {t.subject}
      </div>
      {t.variables?.length ? (
        <div className="dim" style={{ fontSize: '.75rem' }}>
          Variables: {t.variables.map((v) => `{{${v}}}`).join(' ')}
        </div>
      ) : null}
      {!t.editable && t.key ? (
        <div className="dim" style={{ fontSize: '.74rem', marginTop: '.25rem' }}>
          Sends automatically — {TXN_WHEN[t.key] || 'on a system event'}
        </div>
      ) : null}
    </div>
  );
}

function TemplateEditModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [key, setKey] = useState(template?.key ?? '');
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (template?.key) {
        await emailsApi.updateTemplate(template.key, { name, subject, body });
        onSaved('Template saved.');
      } else {
        await emailsApi.createTemplate({ key, name, subject, body });
        onSaved('Template created.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={template ? `Edit — ${template.name}` : 'New Template'}
      onClose={onClose}
      wide
      okLabel="Save"
      busy={busy}
      onOk={() => void save()}
    >
      {error ? <p className="error">{error}</p> : null}
      {!template ? (
        <div className="fr2">
          <label>
            Key
            <input value={key} onChange={(e) => setKey(e.target.value)} required />
          </label>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </div>
      ) : (
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label>
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        Body
        <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
    </Modal>
  );
}

function SendModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!template.key) return;
    const recipients = to.split(/[,;\s]+/).filter(Boolean);
    if (!recipients.length) {
      setError('Select at least one recipient.');
      return;
    }
    setBusy(true);
    try {
      await emailsApi.sendCampaign(template.key, recipients);
      onSaved('Campaign queued.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Send — ${template.name}`}
      onClose={onClose}
      okLabel="Send"
      busy={busy}
      onOk={() => void send()}
    >
      {error ? <p className="error">{error}</p> : null}
      <label>
        Recipients
        <input value={to} placeholder="email addresses, comma-separated" onChange={(e) => setTo(e.target.value)} />
      </label>
    </Modal>
  );
}

async function onChangedJob(fn: () => Promise<unknown>, success: string, onChanged: (msg: string) => void) {
  await fn();
  onChanged(success);
}

function SmtpSettingsForm({ onChanged }: { onChanged: (msg: string) => void }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [fromName, setFromName] = useState('Urb TecTrack');
  const [fromEmail, setFromEmail] = useState('noreply@urbeno.in');
  const [enabled, setEnabled] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    emailsApi
      .smtpSettings()
      .then((s) => {
        setEnabled(s.enabled);
        setHost(s.host);
        setPort(String(s.port));
        setSecure(s.secure);
        setUser(s.user);
        setFromName(s.fromName);
        setFromEmail(s.fromEmail);
        setPasswordSet(s.passwordSet);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load mail settings'));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await emailsApi.saveSmtpSettings({
        enabled,
        host,
        port: Number(port) || 587,
        secure,
        user,
        pass: pass || undefined,
        fromName,
        fromEmail,
      });
      setPass('');
      if (pass) setPasswordSet(true);
      onChanged('Outgoing mail settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError('');
    try {
      await emailsApi.testSmtp(testTo);
      onChanged(`Test email sent to ${testTo}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)}>
      <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--g2)', marginBottom: '.35rem' }}>
        Outgoing mail (SMTP)
      </div>
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.7rem', maxWidth: 640 }}>
        Used for password-reset OTPs, request acknowledgements, certificates and payment reminders. Mail is delivered
        to each recipient&apos;s real address. The SMTP password is read from <code>SMTP_PASS</code> (environment /
        Secrets Manager) and is never stored in the database — leave the password field blank when saving.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <label style={{ display: 'flex', alignItems: 'center', gap: '.45rem', marginBottom: '.7rem' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Send outgoing mail through this SMTP server
      </label>
      <div className="fr2">
        <div className="fg">
          <label>SMTP host</label>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
        </div>
        <div className="fg">
          <label>Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => {
              const next = e.target.value;
              setPort(next);
              const n = Number(next);
              if (n === 587 || n === 25) setSecure(false);
              if (n === 465) setSecure(true);
            }}
          />
        </div>
        <div className="fg">
          <label>Username</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
        </div>
        <div className="fg">
          <label>Password {passwordSet ? <span className="hint">set via SMTP_PASS — leave blank</span> : <span className="hint">set SMTP_PASS in env</span>}</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="fg">
          <label>From name</label>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
        <div className="fg">
          <label>From email</label>
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '.45rem', marginBottom: '.8rem' }}>
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
        Implicit TLS (port 465 only). For Gmail on port 587, leave this <b>off</b> — STARTTLS is used automatically.
      </label>
      <button type="submit" className="btn bp" disabled={busy}>
        Save outgoing mail
      </button>
      <div className="fr2" style={{ marginTop: '1rem', maxWidth: 520 }}>
        <div className="fg">
          <label>Send a test to</label>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="btn bs" disabled={busy || !testTo} onClick={() => void test()}>
            Send test email
          </button>
        </div>
      </div>
    </form>
  );
}
