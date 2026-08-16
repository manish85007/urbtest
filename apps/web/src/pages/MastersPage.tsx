import { useEffect, useState } from 'react';
import { dataApi, emailsApi, type CategorySummary, type ClientSummary, type FactorySummary } from '../api';

type Tab = 'clients' | 'factories' | 'categories' | 'email';

export function MastersPage() {
  const [tab, setTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [outbox, setOutbox] = useState<
    Array<{ id: string; subject: string; status: string; createdAt: string; to: string[] }>
  >([]);
  const [factoryId, setFactoryId] = useState('URB-BLR');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([dataApi.clients(), dataApi.factories()])
      .then(([c, f]) => {
        setClients(c);
        setFactories(f);
        if (f[0]) setFactoryId(f[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (tab !== 'categories' || !factoryId) return;
    dataApi
      .categories(factoryId)
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load categories'));
  }, [tab, factoryId]);

  useEffect(() => {
    if (tab !== 'email') return;
    emailsApi
      .outbox()
      .then(setOutbox)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load outbox'));
  }, [tab]);

  return (
    <div>
      <h1 className="h1">Master data</h1>
      <p className="muted">Read-only view of seeded master records (full CRUD in a later phase).</p>

      <div className="tabs">
        {(
          [
            ['clients', 'Clients & sites'],
            ['factories', 'Factory sites'],
            ['categories', 'Category master'],
            ['email', 'Email outbox'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'on' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {tab === 'clients' ? (
        <section className="card">
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
        </section>
      ) : null}

      {tab === 'factories' ? (
        <section className="card">
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
        </section>
      ) : null}

      {tab === 'categories' ? (
        <section className="card">
          <label className="inline-label">
            Authorization held by
            <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
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
          {categories.length > 150 ? (
            <p className="muted pad">Showing first 150 of {categories.length} entries.</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'email' ? (
        <section className="card">
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
        </section>
      ) : null}
    </div>
  );
}
