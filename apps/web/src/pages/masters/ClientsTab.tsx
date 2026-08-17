import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dataApi, filesApi, type ClientSummary, type LookupRow } from '../../api';
import { FileUpload } from '../../components/FileUpload';
import { Modal } from '../../components/Modal';
import { validClientCode } from '../../lib/lookup-defs';

interface SiteDraft {
  code: string;
  name: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  contactName: string;
  contactPhone: string;
}

const emptySite = (): SiteDraft => ({
  code: '',
  name: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pin: '',
  contactName: '',
  contactPhone: '',
});

interface ClientsTabProps {
  clients: ClientSummary[];
  payTerms: LookupRow[];
  onChanged: (msg: string, href?: string) => void;
}

export function ClientsTab({ clients, payTerms, onChanged }: ClientsTabProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Clients ({clients.length})</div>
          <div className="spacer" />
          <button type="button" className="btn bp bsm" onClick={() => setOpen(true)}>
            + New Client
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Client</th>
                <th>Sites</th>
                <th>Contact</th>
                <th>Requests</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="badge bg-g mono">
                      <b>{c.id}</b>
                    </span>
                  </td>
                  <td>
                    <b>{c.name}</b>
                    <div className="dim" style={{ fontSize: '.72rem' }}>
                      {c.city || ''}
                    </div>
                  </td>
                  <td>
                    {c.siteActive ?? 0} active
                    {(c.siteInactive ?? 0) > 0 ? ` · ${c.siteInactive} inactive` : ''}
                  </td>
                  <td className="dim">
                    {c.contact || '—'}
                    <div style={{ fontSize: '.72rem' }}>{c.email || ''}</div>
                  </td>
                  <td className="mono">{c.requestCount ?? 0}</td>
                  <td>
                    {c.active !== false ? (
                      <span className="badge bg-g">Active</span>
                    ) : (
                      <span className="badge bg-gy">Inactive</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn bs bsm" to={`/masters/clients/${c.id}`}>
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card info-box">
        <div className="section-hd" style={{ borderColor: '#93c5fd', color: 'var(--bl)' }}>
          Client ID rules
        </div>
        <div style={{ fontSize: '.83rem', color: 'var(--g2)', lineHeight: 1.6 }}>
          Each client gets a unique 4-character uppercase code (letters and digits). It is fixed at
          creation and used across invoices, MRNs, reports and exports. Prefixes URB, ADM, SYS and
          TEST are reserved for Urbeno internal use.
        </div>
      </div>
      {open ? (
        <NewClientModal
          clients={clients}
          payTerms={payTerms}
          onClose={() => setOpen(false)}
          onCreated={(id, message) => {
            setOpen(false);
            onChanged(message, `/masters/clients/${id}`);
          }}
        />
      ) : null}
    </>
  );
}

function NewClientModal({
  clients,
  payTerms,
  onClose,
  onCreated,
}: {
  clients: ClientSummary[];
  payTerms: LookupRow[];
  onClose: () => void;
  onCreated: (id: string, msg: string) => void;
}) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [termId, setTermId] = useState(payTerms.find((t) => t.id === 'PT30')?.id ?? payTerms[0]?.id ?? '');
  const [logoIds, setLogoIds] = useState<string[]>([]);
  const [sites, setSites] = useState<SiteDraft[]>([emptySite()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const idErr = validClientCode(id, clients.map((c) => c.id));

  function patchSite(i: number, patch: Partial<SiteDraft>) {
    setSites((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    setError('');
    const codeErr = validClientCode(id, clients.map((c) => c.id));
    if (codeErr) {
      setError(codeErr);
      return;
    }
    if (!name.trim()) {
      setError('Client legal name is required.');
      return;
    }
    const complete = sites.filter((s) => s.code && s.name && s.gstin && s.address);
    if (!complete.length) {
      setError('Add at least one site with a code, name, GST and address.');
      return;
    }
    const term = payTerms.find((t) => t.id === termId);
    setBusy(true);
    try {
      const created = await dataApi.createClient({
        id,
        name,
        city,
        contact,
        phone,
        email,
        payTermsDays: term?.days ?? 30,
        logoFileId: logoIds[0] ?? null,
        sites: complete.map((s) => ({
          code: s.code,
          name: s.name,
          gstin: s.gstin,
          address: s.address,
          city: s.city,
          state: s.state,
          pin: s.pin,
          contactName: s.contactName,
          contactPhone: s.contactPhone,
        })),
      });
      onCreated(created.id, `Client ${created.id} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New Client"
      wide
      onClose={onClose}
      okLabel="Create Client"
      busy={busy}
      onOk={() => void save()}
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Client ID * <span className="hint">4 characters, unique</span>
          <input
            value={id}
            maxLength={4}
            className="mono"
            style={{ textTransform: 'uppercase', fontWeight: 700 }}
            placeholder="ACME"
            onChange={(e) => setId(e.target.value.toUpperCase())}
          />
          {id ? (
            idErr ? <div className="id-err">{idErr}</div> : <div className="id-ok">✓ {id} is available</div>
          ) : null}
        </label>
        <label>
          Legal Name *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Industries Pvt Ltd" />
        </label>
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          Primary Contact
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label>
          Contact Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Contact Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Agreed Payment Terms *
          <select value={termId} onChange={(e) => setTermId(e.target.value)}>
            {payTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="dim" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>
            Sets the due date on every invoice. Once terms elapse, Urb TecTrack emails a payment
            reminder daily until the invoice is settled.
          </div>
        </label>
      </div>
      <div className="section-hd" style={{ marginTop: '.4rem' }}>
        Client Logo <span className="hint">shown in their portal header · PNG/JPG/SVG</span>
      </div>
      {logoIds[0] ? (
        <img className="logo-preview" src={filesApi.url(logoIds[0])} alt="Logo" />
      ) : null}
      <FileUpload kind="logo" label="Upload logo" accept="image/*" value={logoIds} onChange={setLogoIds} />
      <div className="section-hd" style={{ marginTop: '.7rem' }}>
        Sites <span className="hint">each site needs its own GST and address</span>
      </div>
      {sites.map((s, i) => (
        <div key={i} className="card cs-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.35rem' }}>
            <b style={{ fontSize: '.8rem', color: 'var(--g2)' }}>Site {i + 1}</b>
            <div className="spacer" />
            <button
              type="button"
              className="btn brd bsm"
              onClick={() => setSites((prev) => (prev.length === 1 ? [emptySite()] : prev.filter((_, idx) => idx !== i)))}
            >
              ×
            </button>
          </div>
          <div className="fr4">
            <label>
              Code *
              <input value={s.code} maxLength={6} style={{ textTransform: 'uppercase' }} onChange={(e) => patchSite(i, { code: e.target.value.toUpperCase() })} />
            </label>
            <label>
              Site Name *
              <input value={s.name} onChange={(e) => patchSite(i, { name: e.target.value })} />
            </label>
            <label>
              GST *
              <input value={s.gstin} style={{ textTransform: 'uppercase' }} onChange={(e) => patchSite(i, { gstin: e.target.value.toUpperCase() })} />
            </label>
            <label>
              PIN
              <input value={s.pin} onChange={(e) => patchSite(i, { pin: e.target.value })} />
            </label>
          </div>
          <label>
            Address *
            <input value={s.address} onChange={(e) => patchSite(i, { address: e.target.value })} />
          </label>
          <div className="fr4" style={{ marginTop: '.35rem' }}>
            <label>
              City
              <input value={s.city} onChange={(e) => patchSite(i, { city: e.target.value })} />
            </label>
            <label>
              State
              <input value={s.state} onChange={(e) => patchSite(i, { state: e.target.value })} />
            </label>
            <label>
              Pickup Contact
              <input value={s.contactName} onChange={(e) => patchSite(i, { contactName: e.target.value })} />
            </label>
            <label>
              Contact Phone
              <input value={s.contactPhone} onChange={(e) => patchSite(i, { contactPhone: e.target.value })} />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="btn bs bsm" onClick={() => setSites((prev) => [...prev, emptySite()])}>
        + Add Site
      </button>
    </Modal>
  );
}
