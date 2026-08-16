import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataApi, emailsApi, type ClientSummary, type FactorySummary, type LookupRow, type UserRow } from '../api';
import { CategoriesTab } from './masters/CategoriesTab';
import { ClientsTab } from './masters/ClientsTab';
import { EmailTab } from './masters/EmailTab';
import { FactoriesTab } from './masters/FactoriesTab';
import { LookupsTab } from './masters/LookupsTab';
import { UsersTab } from './masters/UsersTab';

type Tab = 'clients' | 'users' | 'factories' | 'cats' | 'lookups' | 'email';

const TABS: Array<[Tab, string]> = [
  ['clients', 'Clients & Sites'],
  ['users', 'Users'],
  ['factories', 'Factory Sites'],
  ['cats', 'Category Master'],
  ['lookups', 'Lookup Lists'],
  ['email', 'Email & Templates'],
];

export function MastersPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some(([id]) => id === tabParam) ? (tabParam as Tab) : 'clients';
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [lookups, setLookups] = useState<LookupRow[]>([]);
  const [payTerms, setPayTerms] = useState<LookupRow[]>([]);
  const [outbox, setOutbox] = useState<
    Array<{
      id: string;
      subject: string;
      status: string;
      createdAt: string;
      sentAt: string | null;
      to: string[];
      body?: string;
      templateKey?: string;
      templateName?: string | null;
    }>
  >([]);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      key: string | null;
      name: string;
      subject: string;
      body: string;
      editable: boolean;
      variables?: string[];
    }>
  >([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const [c, f, u, l] = await Promise.all([
      dataApi.clients(true),
      dataApi.factories(true),
      dataApi.users(),
      dataApi.allLookups(),
    ]);
    setClients(c);
    setFactories(f);
    setUsers(u);
    setLookups(l);
    setPayTerms(l.filter((x) => x.category === 'payTerms' && x.active !== false));
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (tab !== 'email') return;
    emailsApi.outbox().then(setOutbox).catch(() => undefined);
    emailsApi.templates().then(setTemplates).catch(() => undefined);
  }, [tab]);

  async function onChanged(success: string) {
    setError('');
    setMsg(success);
    try {
      await reload();
      if (tab === 'email') {
        await emailsApi.outbox().then(setOutbox);
        await emailsApi.templates().then(setTemplates);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reload failed');
    }
  }

  return (
    <div>
      <div className="f-row" style={{ marginBottom: '.9rem' }}>
        <div>
          <h1 className="h1">Master Data</h1>
          <div className="p-mu" style={{ margin: 0 }}>
            Everything the platform references — clients, sites, users, factories, categories and lookups
          </div>
        </div>
      </div>
      {msg ? <p className="ok-msg">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="card" style={{ padding: '.4rem' }}>
        <div style={{ display: 'flex', gap: '.2rem', flexWrap: 'wrap' }}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`inv-tab ${tab === id ? 'on' : ''}`}
              style={{ borderRadius: 7, borderBottom: '1px solid var(--bd)' }}
              onClick={() => setParams(id === 'clients' ? {} : { tab: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'clients' ? <ClientsTab clients={clients} payTerms={payTerms} onChanged={onChanged} /> : null}
      {tab === 'users' ? (
        <UsersTab users={users} clients={clients} factories={factories} onChanged={onChanged} />
      ) : null}
      {tab === 'factories' ? <FactoriesTab factories={factories} users={users} onChanged={onChanged} /> : null}
      {tab === 'cats' ? <CategoriesTab factories={factories} onChanged={onChanged} /> : null}
      {tab === 'lookups' ? <LookupsTab lookups={lookups} onChanged={onChanged} /> : null}
      {tab === 'email' ? <EmailTab templates={templates} outbox={outbox} onChanged={onChanged} /> : null}
    </div>
  );
}
