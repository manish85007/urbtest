import { useEffect, useState } from 'react';
import { dataApi, type ClientSummary, type FactorySummary, type SiteSummary, type UserRow } from '../../api';
import { Modal } from '../../components/Modal';

interface UserFormModalProps {
  clients: ClientSummary[];
  factories: FactorySummary[];
  user?: UserRow | null;
  presetClientId?: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function UserFormModal({
  clients,
  factories,
  user,
  presetClientId,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<'admin' | 'factory' | 'client'>(
    (user?.role as 'admin' | 'factory' | 'client') || 'client',
  );
  const [clientId, setClientId] = useState(user?.clientId || presetClientId || clients[0]?.id || '');
  const [siteIds, setSiteIds] = useState<string[]>(user?.siteIds ?? []);
  const [factoryIds, setFactoryIds] = useState<string[]>(user?.factoryIds ?? []);
  const [active, setActive] = useState(user?.active !== false);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== 'client' || !clientId) {
      setSites([]);
      return;
    }
    dataApi.sites(clientId, true).then(setSites).catch(() => setSites([]));
  }, [role, clientId]);

  function toggle(list: string[], id: string, on: boolean) {
    return on ? [...list, id] : list.filter((x) => x !== id);
  }

  async function save() {
    setError('');
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (role === 'client' && !clientId) {
      setError('Select which client this user belongs to.');
      return;
    }
    setBusy(true);
    try {
      if (user) {
        await dataApi.updateUser(user.id, {
          name,
          role,
          clientId: role === 'client' ? clientId : null,
          siteIds: role === 'client' ? siteIds : [],
          factoryIds: role === 'factory' ? factoryIds : [],
          active,
        });
        onSaved('User updated.');
      } else {
        if (!email.trim()) {
          setError('Email is required.');
          setBusy(false);
          return;
        }
        const created = await dataApi.createUser({
          email,
          name,
          role,
          clientId: role === 'client' ? clientId : null,
          siteIds: role === 'client' ? siteIds : [],
          factoryIds: role === 'factory' ? factoryIds : [],
        });
        onSaved(
          created.tempPassword
            ? `User created — temporary password ${created.tempPassword}`
            : 'User created.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={user ? `Edit User — ${user.name}` : 'New User'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn bs" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn bp" disabled={busy} onClick={() => void save()}>
            {user ? 'Save User' : 'Create User'}
          </button>
        </>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Full Name *
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email *
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} />
        </label>
      </div>
      <label>
        Role *
        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="client">Client user</option>
          <option value="admin">Urbeno admin</option>
          <option value="factory">Factory manager</option>
        </select>
      </label>
      {role === 'client' ? (
        <>
          <label>
            Client *
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteIds([]); }}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </label>
          <div className="fg">
            <label>
              Site Access <span className="hint">leave all unchecked for access to every site</span>
            </label>
            <div className="check-list">
              {sites.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={siteIds.includes(s.id)}
                    onChange={(e) => setSiteIds(toggle(siteIds, s.id, e.target.checked))}
                  />
                  {s.name} ({s.code})
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {role === 'factory' ? (
        <div className="fg">
          <label>
            Factory Sites <span className="hint">leave all unchecked for every factory</span>
          </label>
          <div className="check-list">
            {factories.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={factoryIds.includes(f.id)}
                  onChange={(e) => setFactoryIds(toggle(factoryIds, f.id, e.target.checked))}
                />
                {f.name} ({f.id})
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {role === 'admin' ? (
        <p className="dim">Admins have full access to every client, site and factory.</p>
      ) : null}
      {user ? (
        <label>
          Status
          <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Active</option>
            <option value="0">Disabled</option>
          </select>
        </label>
      ) : (
        <div className="note-box" style={{ background: 'var(--bl2)', color: 'var(--bl)' }}>
          A welcome email with a temporary password will be sent automatically.
        </div>
      )}
    </Modal>
  );
}
