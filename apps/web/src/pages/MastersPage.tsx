import { useEffect, useState } from 'react';
import { adminApi, dataApi, emailsApi, type CategorySummary, type ClientSummary, type FactorySummary } from '../api';

type Tab = 'clients' | 'sites' | 'users' | 'factories' | 'categories' | 'lookups' | 'email';

export function MastersPage() {
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; name: string; role: string; clientId: string | null }>
  >([]);
  const [outbox, setOutbox] = useState<
    Array<{ id: string; subject: string; status: string; createdAt: string; to: string[] }>
  >([]);
  const [templates, setTemplates] = useState<
    Array<{ key: string | null; name: string; subject: string; body: string; editable: boolean }>
  >([]);
  const [factoryId, setFactoryId] = useState('URB-BLR');
  const [siteClientId, setSiteClientId] = useState('TCPL');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const [c, f] = await Promise.all([dataApi.clients(), dataApi.factories()]);
    setClients(c);
    setFactories(f);
    if (f[0]) setFactoryId(f[0].id);
    if (c[0]) setSiteClientId(c[0].id);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (tab === 'categories' && factoryId) {
      dataApi.categories(factoryId).then(setCategories).catch(() => undefined);
    }
    if (tab === 'users') {
      dataApi.users().then(setUsers).catch(() => undefined);
    }
    if (tab === 'email') {
      emailsApi.outbox().then(setOutbox).catch(() => undefined);
      emailsApi.templates().then(setTemplates).catch(() => undefined);
    }
  }, [tab, factoryId]);

  async function act(fn: () => Promise<unknown>, success: string) {
    setError('');
    setMsg('');
    try {
      await fn();
      setMsg(success);
      await reload();
      if (tab === 'users') await dataApi.users().then(setUsers);
      if (tab === 'email') {
        await emailsApi.outbox().then(setOutbox);
        await emailsApi.templates().then(setTemplates);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div>
      <h1 className="h1">Masters</h1>
      <p className="p-mu">Clients, sites, users, factories, category master, lookups, and the email queue.</p>
      {msg ? <p className="ok-msg">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="tabs">
        {(
          [
            ['clients', 'Clients'],
            ['sites', 'Sites'],
            ['users', 'Users'],
            ['factories', 'Factories'],
            ['categories', 'Categories'],
            ['lookups', 'Lookups'],
            ['email', 'Email & jobs'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'clients' ? (
        <section className="card">
          <h2>Add client</h2>
          <ClientForm onSubmit={(body) => act(() => dataApi.createClient(body), 'Client created.')} />
          <h2 className="mt">Clients</h2>
          <ClientTable clients={clients} />
        </section>
      ) : null}

      {tab === 'sites' ? (
        <section className="card">
          <h2>Add site</h2>
          <label>
            Client
            <select value={siteClientId} onChange={(e) => setSiteClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <SiteForm
            onSubmit={(body) =>
              act(() => dataApi.createSite(siteClientId, body), 'Site created.')
            }
          />
        </section>
      ) : null}

      {tab === 'users' ? (
        <section className="card">
          <h2>Add user</h2>
          <UserForm clients={clients} factories={factories} onSubmit={(body) => act(() => dataApi.createUser(body), 'User created (password: demo unless set).')} />
          <h2 className="mt">Users</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.clientId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'factories' ? (
        <section className="card">
          <h2>Add / update factory</h2>
          <FactoryForm onSubmit={(body) => act(() => dataApi.upsertFactory(body), 'Factory saved.')} />
          <FactoryTable factories={factories} />
        </section>
      ) : null}

      {tab === 'categories' ? (
        <section className="card">
          <label className="inline-label">
            Factory
            <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <h2>Add category</h2>
          <CategoryForm
            factoryId={factoryId}
            onSubmit={(body) => act(() => dataApi.upsertCategory(body), 'Category saved.')}
          />
          <CategoryTable categories={categories} />
        </section>
      ) : null}

      {tab === 'lookups' ? (
        <section className="card">
          <h2>Add lookup entry</h2>
          <LookupForm onSubmit={(body) => act(() => dataApi.upsertLookup(body), 'Lookup saved.')} />
        </section>
      ) : null}

      {tab === 'email' ? (
        <section className="card">
          <div className="form-actions">
            <button type="button" className="btn primary" onClick={() => act(() => adminApi.runEmailQueue(), 'Email queue processed.')}>
              Process email queue
            </button>
            <button type="button" className="btn secondary" onClick={() => act(() => adminApi.runReminders(), 'Reminders + email queue run.')}>
              Run reminders job
            </button>
          </div>
          <h2 className="mt">Templates</h2>
          <TemplateList
            templates={templates}
            onSave={(key, body) => act(() => emailsApi.updateTemplate(key, body), 'Template saved.')}
            onCampaign={(key, to) => act(() => emailsApi.sendCampaign(key, to), 'Campaign queued.')}
            onCreate={(body) => act(() => emailsApi.createTemplate(body), 'Template created.')}
          />
          <h2 className="mt">Outbox</h2>
          <OutboxTable outbox={outbox} />
        </section>
      ) : null}
    </div>
  );
}

function ClientForm({ onSubmit }: { onSubmit: (body: { id: string; name: string; city?: string }) => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id, name, city });
      }}
    >
      <div className="fr3">
        <label>
          Code (2–4 chars)
          <input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} required maxLength={4} />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="btn primary">
        Create client
      </button>
    </form>
  );
}

function SiteForm({ onSubmit }: { onSubmit: (body: { code: string; name: string; address?: string }) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ code, name, address });
      }}
    >
      <div className="fr2">
        <label>
          Site code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
        </label>
        <label>
          Site name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <label>
        Address
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <button type="submit" className="btn primary">
        Create site
      </button>
    </form>
  );
}

function UserForm({
  clients,
  factories,
  onSubmit,
}: {
  clients: ClientSummary[];
  factories: FactorySummary[];
  onSubmit: (body: {
    email: string;
    name: string;
    role: 'admin' | 'factory' | 'client';
    clientId?: string | null;
    factoryIds?: string[];
  }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'factory' | 'client'>('client');
  const [clientId, setClientId] = useState('');
  const [factoryId, setFactoryId] = useState('URB-BLR');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email,
          name,
          role,
          clientId: role === 'client' ? clientId : null,
          factoryIds: role === 'factory' ? [factoryId] : [],
        });
      }}
    >
      <div className="fr2">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="client">Client user</option>
          <option value="factory">Factory manager</option>
          <option value="admin">Urbeno admin</option>
        </select>
      </label>
      {role === 'client' ? (
        <label>
          Client
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Select…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {role === 'factory' ? (
        <label>
          Factory
          <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="submit" className="btn primary">
        Create user
      </button>
    </form>
  );
}

function LookupForm({
  onSubmit,
}: {
  onSubmit: (body: { category: string; id: string; label: string }) => void;
}) {
  const [category, setCategory] = useState('vehicleType');
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ category, id, label });
      }}
    >
      <div className="fr3">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="vehicleType">Vehicle types</option>
            <option value="teamRole">Team roles</option>
            <option value="paymentMode">Payment modes</option>
          </select>
        </label>
        <label>
          Code
          <input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} required />
        </label>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn primary">
        Save lookup
      </button>
    </form>
  );
}

function ClientTable({ clients }: { clients: ClientSummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Client</th>
            <th>City</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.city ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactoryForm({
  onSubmit,
}: {
  onSubmit: (body: { id: string; name: string; address?: string; gstin?: string }) => void;
}) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id, name, address });
      }}
    >
      <div className="fr2">
        <label>
          Factory ID
          <input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} required />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      </div>
      <label>
        Address
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <button type="submit" className="btn primary">
        Save factory
      </button>
    </form>
  );
}

function CategoryForm({
  factoryId,
  onSubmit,
}: {
  factoryId: string;
  onSubmit: (body: {
    factoryId: string;
    entryId: string;
    description: string;
    groupCode: string;
    capacityTpa: number;
  }) => void;
}) {
  const [entryId, setEntryId] = useState('');
  const [description, setDescription] = useState('');
  const [groupCode, setGroupCode] = useState('ITEW');
  const [capacityTpa, setCapacityTpa] = useState('10');
  return (
    <form
      className="sub-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          factoryId,
          entryId,
          description,
          groupCode,
          capacityTpa: Number(capacityTpa),
        });
      }}
    >
      <div className="fr3">
        <label>
          Entry ID
          <input value={entryId} onChange={(e) => setEntryId(e.target.value)} required />
        </label>
        <label>
          Group
          <input value={groupCode} onChange={(e) => setGroupCode(e.target.value)} required />
        </label>
        <label>
          Capacity TPA
          <input type="number" min="0" step="0.01" value={capacityTpa} onChange={(e) => setCapacityTpa(e.target.value)} required />
        </label>
      </div>
      <label>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <button type="submit" className="btn primary">
        Save category
      </button>
    </form>
  );
}

function TemplateList({
  templates,
  onSave,
  onCampaign,
  onCreate,
}: {
  templates: Array<{ key: string | null; name: string; subject: string; body: string; editable: boolean }>;
  onSave: (key: string, body: { subject: string; body: string }) => void;
  onCampaign: (key: string, to: string[]) => void;
  onCreate: (body: { key: string; name: string; subject: string; body: string }) => void;
}) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');

  return (
    <div>
      {templates.map((t) => (
        <div key={t.key ?? t.name} className="sub-card">
          <div className="sub-card-hd">
            <b>{t.name}</b>
            <span className={`badge ${t.editable ? 'bg-bl' : 'bg-gy'}`}>{t.editable ? 'Editable' : 'Fixed'}</span>
          </div>
          <p className="dim sm">{t.subject}</p>
          {t.editable && t.key && editKey === t.key ? (
            <form
              className="sub-form"
              onSubmit={(e) => {
                e.preventDefault();
                onSave(t.key!, { subject, body });
                setEditKey(null);
              }}
            >
              <label>
                Subject
                <input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label>
                Body
                <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              <button type="submit" className="btn primary">
                Save
              </button>
            </form>
          ) : null}
          <div className="form-actions">
            {t.editable && t.key ? (
              <button
                type="button"
                className="btn bs bsm"
                onClick={() => {
                  setEditKey(t.key);
                  setSubject(t.subject);
                  setBody(t.body);
                }}
              >
                Edit
              </button>
            ) : null}
            {t.key ? (
              <form
                className="fr2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onCampaign(
                    t.key!,
                    to.split(/[,;\s]+/).filter(Boolean),
                  );
                }}
              >
                <input placeholder="recipient emails" value={to} onChange={(e) => setTo(e.target.value)} />
                <button type="submit" className="btn bp bsm">
                  Send
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ))}
      <h3>New custom template</h3>
      <form
        className="sub-form"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ key: newKey, name: newName, subject, body });
        }}
      >
        <div className="fr2">
          <label>
            Key
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} required />
          </label>
          <label>
            Name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </label>
        </div>
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Body
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
        </label>
        <button type="submit" className="btn primary">
          Create template
        </button>
      </form>
    </div>
  );
}

function FactoryTable({ factories }: { factories: FactorySummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Factory</th>
          </tr>
        </thead>
        <tbody>
          {factories.map((f) => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({ categories }: { categories: CategorySummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Entry</th>
            <th>Group</th>
            <th>Description</th>
            <th>TPA</th>
          </tr>
        </thead>
        <tbody>
          {categories.slice(0, 150).map((c) => (
            <tr key={c.id}>
              <td>{c.entryId}</td>
              <td>{c.groupCode}</td>
              <td>{c.description}</td>
              <td>{c.capacityTpa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutboxTable({
  outbox,
}: {
  outbox: Array<{ id: string; subject: string; status: string; createdAt: string; to: string[] }>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Subject</th>
            <th>To</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {outbox.map((m) => (
            <tr key={m.id}>
              <td className="dim">{m.createdAt.slice(0, 19).replace('T', ' ')}</td>
              <td>{m.subject}</td>
              <td>{m.to.join(', ')}</td>
              <td>
                <span className="badge">{m.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
