import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dataApi, filesApi, type ClientDetail, type FactorySummary, type LookupRow, type SiteSummary } from '../api';
import { CompletionDialog } from '../components/CompletionDialog';
import { FileUpload } from '../components/FileUpload';
import { DateField } from '../components/DateField';
import { Modal } from '../components/Modal';
import { UserFormModal } from './masters/UserFormModal';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [payTerms, setPayTerms] = useState<LookupRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editClient, setEditClient] = useState(false);
  const [siteForm, setSiteForm] = useState<SiteSummary | null | undefined>(undefined);
  const [userOpen, setUserOpen] = useState(false);
  const [plantOpen, setPlantOpen] = useState(false);

  async function load() {
    if (!id) return;
    const [c, f, terms] = await Promise.all([
      dataApi.client(id),
      dataApi.factories(true),
      dataApi.lookups('payTerms'),
    ]);
    setClient(c);
    setFactories(f);
    setPayTerms(terms);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load client'));
  }, [id]);

  async function onChanged(success: string) {
    setMsg(success);
    setError('');
    setEditClient(false);
    setSiteForm(undefined);
    setUserOpen(false);
    setPlantOpen(false);
    await load();
  }

  async function toggleSite(site: SiteSummary, activate: boolean) {
    if (!activate) {
      const used = client?.stats.requests ?? 0;
      if (used && !confirm('This site may have requests against it. Deactivating hides it from new requests but keeps all history. Continue?')) {
        return;
      }
    }
    try {
      await dataApi.updateSite(site.id, { active: activate });
      await onChanged(activate ? 'Site activated.' : 'Site deactivated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (!client && !error) return <p className="muted">Loading client…</p>;
  if (!client) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
          {client.logoFileId ? (
            <img className="logo-preview" src={filesApi.url(client.logoFileId)} alt="" />
          ) : (
            <div className="logo-fallback">{client.name[0]}</div>
          )}
          <div>
            <div className="h1">{client.name}</div>
            <div className="p-mu" style={{ margin: 0 }}>
              <span className="badge bg-g mono">{client.id}</span> · {client.city || ''} · {client.stats.requests}{' '}
              requests · {client.users.length} users
            </div>
          </div>
        </div>
        <div className="spacer" />
        <Link className="btn bs" to="/masters">
          ← Masters
        </Link>
        <button type="button" className="btn bs" onClick={() => setEditClient(true)}>
          ✏️ Edit Client
        </button>
        <button type="button" className="btn bp" onClick={() => setSiteForm(null)}>
          + Add Site
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {msg ? <CompletionDialog message={msg} onClose={() => setMsg('')} /> : null}

      <div className="stats" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="stat-l">Requests</div>
          <div className="stat-v">{client.stats.requests}</div>
          <div className="stat-t">{client.stats.open} open</div>
        </div>
        <div className="stat">
          <div className="stat-l">Lifetime Recycled</div>
          <div className="stat-v">{client.stats.tonnes.toFixed(2)}</div>
          <div className="stat-t">tonnes</div>
        </div>
        <div className="stat">
          <div className="stat-l">Trees Earned</div>
          <div className="stat-v">{client.stats.treesEarned}</div>
          <div className="stat-t">1 per tonne</div>
        </div>
        <div className="stat">
          <div className="stat-l">Trees Planted</div>
          <div className="stat-v" style={{ color: client.stats.treesOwed > 0 ? 'var(--am)' : 'var(--g2)' }}>
            {client.stats.treesPlanted}
          </div>
          <div className="stat-t">{client.stats.treesOwed > 0 ? `${client.stats.treesOwed} owed` : 'up to date'}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Sites ({client.sites.length})</div>
              <div className="spacer" />
              <button type="button" className="btn bs bsm" onClick={() => setSiteForm(null)}>
                + Add Site
              </button>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Site</th>
                    <th>GST</th>
                    <th>Address</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {client.sites.map((st) => (
                    <tr key={st.id} style={st.active === false ? { opacity: 0.55 } : undefined}>
                      <td className="mono">
                        <b>{st.code}</b>
                      </td>
                      <td>
                        {st.name}
                        <div className="dim" style={{ fontSize: '.72rem' }}>
                          {st.city || ''}
                          {st.state ? `, ${st.state}` : ''}
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: '.75rem' }}>
                        {st.gstin || '—'}
                      </td>
                      <td className="dim" style={{ fontSize: '.75rem', maxWidth: 180 }}>
                        {(st.address || '').slice(0, 50)}
                        {(st.address || '').length > 50 ? '…' : ''}
                      </td>
                      <td className="dim" style={{ fontSize: '.75rem' }}>
                        {st.contactName || '—'}
                        <div className="mono">{st.contactPhone || ''}</div>
                      </td>
                      <td>
                        {st.active === false ? (
                          <span className="badge bg-gy">Inactive</span>
                        ) : (
                          <span className="badge bg-g">Active</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn bs bsm" onClick={() => setSiteForm(st)}>
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className={`btn bsm ${st.active === false ? 'bg-btn' : 'brd'}`}
                          onClick={() => void toggleSite(st, st.active === false)}
                        >
                          {st.active === false ? 'Activate' : 'Deactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Users ({client.users.length})</div>
              <div className="spacer" />
              <button type="button" className="btn bs bsm" onClick={() => setUserOpen(true)}>
                + Add User
              </button>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Site Access</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {client.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <b>{u.name}</b>
                      </td>
                      <td className="dim">{u.email}</td>
                      <td>
                        {u.siteIds?.length ? (
                          u.siteIds.map((sid) => {
                            const site = client.sites.find((s) => s.id === sid);
                            return (
                              <span key={sid} className="badge bg-bl">
                                {site?.code ?? sid}
                              </span>
                            );
                          })
                        ) : (
                          <span className="badge bg-g">All sites</span>
                        )}
                      </td>
                      <td>
                        {u.active !== false ? (
                          <span className="badge bg-g">Active</span>
                        ) : (
                          <span className="badge bg-gy">Disabled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-ttl" style={{ marginBottom: '.5rem' }}>
              Client Details
            </div>
            <div className="tile" style={{ marginBottom: '.4rem' }}>
              <div className="tile-l">Client ID</div>
              <div className="tile-v mono">{client.id}</div>
            </div>
            <div className="tile" style={{ marginBottom: '.4rem' }}>
              <div className="tile-l">Contact</div>
              <div className="tile-v">{client.contact || '—'}</div>
            </div>
            <div className="tile" style={{ marginBottom: '.4rem' }}>
              <div className="tile-l">Phone</div>
              <div className="tile-v mono">{client.phone || '—'}</div>
            </div>
            <div className="tile" style={{ marginBottom: '.4rem' }}>
              <div className="tile-l">Email</div>
              <div className="tile-v" style={{ fontSize: '.78rem' }}>
                {client.email || '—'}
              </div>
            </div>
            <div className="tile">
              <div className="tile-l">Portal Logo</div>
              <div style={{ marginTop: '.3rem' }}>
                {client.logoFileId ? (
                  <>
                    <img className="logo-preview" src={filesApi.url(client.logoFileId)} alt="" />
                    <div className="dim" style={{ fontSize: '.72rem', marginTop: '.25rem' }}>
                      Header display: {client.showPortalLogo ? 'On' : 'Off'}
                    </div>
                  </>
                ) : (
                  <span className="dim" style={{ fontSize: '.78rem' }}>
                    not set
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">Tree Ledger</div>
              <div className="spacer" />
              <button type="button" className="btn bs bsm" onClick={() => setPlantOpen(true)}>
                + Log Planting
              </button>
            </div>
            {!client.plantings.length ? (
              <div className="dim" style={{ fontSize: '.82rem' }}>
                No plantings recorded
              </div>
            ) : (
              client.plantings.map((t) => (
                <div key={t.id} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--bd)', fontSize: '.82rem' }}>
                  <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                    <b>
                      {t.trees} tree{t.trees > 1 ? 's' : ''}
                    </b>
                    <span className="dim">{t.plantedAt}</span>
                  </div>
                  <div className="dim" style={{ fontSize: '.74rem' }}>
                    {t.location || ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {editClient ? (
        <EditClientModal client={client} payTerms={payTerms} onClose={() => setEditClient(false)} onSaved={onChanged} />
      ) : null}
      {siteForm !== undefined ? (
        <SiteModal clientId={client.id} site={siteForm} onClose={() => setSiteForm(undefined)} onSaved={onChanged} />
      ) : null}
      {userOpen ? (
        <UserFormModal
          clients={[{ id: client.id, name: client.name, city: client.city }]}
          factories={factories}
          presetClientId={client.id}
          onClose={() => setUserOpen(false)}
          onSaved={onChanged}
        />
      ) : null}
      {plantOpen ? (
        <PlantingModal clientId={client.id} onClose={() => setPlantOpen(false)} onSaved={onChanged} />
      ) : null}
    </div>
  );
}

function EditClientModal({
  client,
  payTerms,
  onClose,
  onSaved,
}: {
  client: ClientDetail;
  payTerms: LookupRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(client.name);
  const [city, setCity] = useState(client.city ?? '');
  const [contact, setContact] = useState(client.contact ?? '');
  const [phone, setPhone] = useState(client.phone ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [termDays, setTermDays] = useState(String(client.payTermsDays));
  const [active, setActive] = useState(client.active);
  const [logoIds, setLogoIds] = useState<string[]>(client.logoFileId ? [client.logoFileId] : []);
  const [showPortalLogo, setShowPortalLogo] = useState(!!client.showPortalLogo);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError('Legal name is required.');
      return;
    }
    setBusy(true);
    try {
      await dataApi.updateClient(client.id, {
        name,
        city,
        contact,
        phone,
        email,
        payTermsDays: Number(termDays) || 0,
        logoFileId: logoIds[0] ?? null,
        showPortalLogo,
        active,
      });
      onSaved('Client updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit Client — ${client.id}`}
      onClose={onClose}
      okLabel="Save Changes"
      busy={busy}
      onOk={() => void save()}
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Client ID <span className="hint">immutable</span>
          <input value={client.id} disabled className="mono" />
        </label>
        <label>
          Legal Name *
          <input value={name} onChange={(e) => setName(e.target.value)} />
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
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Agreed Payment Terms *
          <select value={termDays} onChange={(e) => setTermDays(e.target.value)}>
            {payTerms.map((t) => (
              <option key={t.id} value={String(t.days ?? 30)}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
      </div>
      <div className="section-hd">Portal Logo</div>
      <p className="dim" style={{ fontSize: '.78rem', margin: '0 0 .45rem' }}>
        Optional. When enabled, the logo appears in the client portal header.
      </p>
      {logoIds[0] ? <img className="logo-preview" src={filesApi.url(logoIds[0])} alt="" /> : null}
      <FileUpload kind="logo" label="Upload logo" accept="image/*" value={logoIds} onChange={setLogoIds} />
      <label className="legal-consent-check" style={{ marginTop: '.55rem' }}>
        <input
          type="checkbox"
          checked={showPortalLogo}
          onChange={(e) => setShowPortalLogo(e.target.checked)}
          disabled={!logoIds[0]}
        />
        <span>Show logo on client portal header</span>
      </label>
    </Modal>
  );
}

function SiteModal({
  clientId,
  site,
  onClose,
  onSaved,
}: {
  clientId: string;
  site: SiteSummary | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [code, setCode] = useState(site?.code ?? '');
  const [name, setName] = useState(site?.name ?? '');
  const [gstin, setGstin] = useState(site?.gstin ?? '');
  const [pin, setPin] = useState(site?.pin ?? '');
  const [address, setAddress] = useState(site?.address ?? '');
  const [city, setCity] = useState(site?.city ?? '');
  const [state, setState] = useState(site?.state ?? '');
  const [contactName, setContactName] = useState(site?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(site?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(site?.contactEmail ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gstBusy, setGstBusy] = useState(false);
  const [gstHint, setGstHint] = useState('');

  async function lookupGst() {
    if (!gstin.trim()) return;
    setGstBusy(true);
    setGstHint('');
    try {
      const r = await dataApi.lookupGstin(gstin);
      setGstin(r.gstin);
      if (r.address?.line) setAddress(r.address.line);
      if (r.address?.city) setCity(r.address.city);
      if (r.address?.state) setState(r.address.state);
      if (r.address?.pin) setPin(r.address.pin);
      if (!name.trim() && (r.tradeName || r.legalName)) setName(r.tradeName || r.legalName || '');
      setGstHint(
        r.lookedUp
          ? `✓ ${r.status || 'Found'} — ${r.legalName || r.gstin}`
          : r.message || 'Format OK — enter address manually if not prefilled.',
      );
    } catch (err) {
      setGstHint(err instanceof Error ? err.message : 'GST lookup failed');
    } finally {
      setGstBusy(false);
    }
  }

  async function save() {
    if (!code.trim() || !name.trim() || !gstin.trim() || !address.trim()) {
      setError('Site code, name, GST and address are all required.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        code,
        name,
        gstin,
        address,
        city,
        state,
        pin,
        contactName,
        contactPhone,
        contactEmail,
      };
      if (site) {
        await dataApi.updateSite(site.id, body);
        onSaved('Site updated.');
      } else {
        await dataApi.createSite(clientId, body);
        onSaved(`Site ${code.toUpperCase()} added.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={site ? `Edit Site — ${site.name}` : 'Add Site'}
      onClose={onClose}
      okLabel={site ? 'Save Site' : 'Add Site'}
      busy={busy}
      onOk={() => void save()}
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Site Code *
          <input className="mono" value={code} disabled={!!site} maxLength={6} style={{ textTransform: 'uppercase' }} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <label>
          Site Name *
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          GST Number *
          <div style={{ display: 'flex', gap: '.35rem' }}>
            <input
              className="mono"
              value={gstin}
              style={{ textTransform: 'uppercase', flex: 1 }}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="btn bs bsm"
              disabled={!gstin.trim() || gstBusy}
              onClick={() => void lookupGst()}
            >
              {gstBusy ? '…' : 'Verify'}
            </button>
          </div>
          {gstHint ? <div className="dim" style={{ fontSize: '.72rem', marginTop: '.2rem' }}>{gstHint}</div> : null}
        </label>
        <label>
          PIN Code
          <input value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
      </div>
      <label>
        Full Address *
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <div className="fr2">
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          State
          <input value={state} onChange={(e) => setState(e.target.value)} />
        </label>
      </div>
      <div className="section-hd">Pickup Contact</div>
      <div className="fr3">
        <label>
          Name
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

function PlantingModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [trees, setTrees] = useState('10');
  const [plantedAt, setPlantedAt] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await dataApi.recordPlanting({
        trees: Number(trees),
        plantedAt,
        location,
        note,
        clientId,
      });
      onSaved('Planting recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Log Planting"
      onClose={onClose}
      okLabel="Save"
      busy={busy}
      onOk={() => void save()}
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Trees
          <input type="number" min={1} value={trees} onChange={(e) => setTrees(e.target.value)} />
        </label>
        <DateField label="Date" value={plantedAt} onChange={setPlantedAt} />
      </div>
      <label>
        Location
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Modal>
  );
}
