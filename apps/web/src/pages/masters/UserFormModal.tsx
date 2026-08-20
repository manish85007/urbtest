import { useEffect, useState } from 'react';
import { dataApi, type ClientSummary, type FactorySummary, type SiteSummary, type UserRow } from '../../api';
import { Modal } from '../../components/Modal';

const FEATURE_FLAGS: Array<{ id: string; label: string; roles: Array<'admin' | 'operations' | 'factory' | 'client'> }> = [
  { id: 'reports.summary', label: 'Report: Request Summary', roles: ['admin', 'operations'] },
  { id: 'reports.invoices', label: 'Report: Invoice Register', roles: ['admin', 'operations'] },
  { id: 'reports.sustain', label: 'Report: Sustainability', roles: ['admin', 'operations'] },
  { id: 'reports.heroes', label: 'Report: Recycling Heroes', roles: ['admin', 'operations'] },
  { id: 'reports.mrn', label: 'Report: MRN Register', roles: ['factory'] },
  { id: 'reports.form6', label: 'Report: Form 6 Log', roles: ['factory', 'client'] },
  { id: 'reports.cod', label: 'Report: Certificate Log', roles: ['factory', 'client'] },
  { id: 'reports.category', label: 'Report: Category Recovery', roles: ['factory', 'client'] },
  { id: 'reports.capacity', label: 'Report: Capacity Utilisation', roles: ['factory'] },
  { id: 'compliance.email', label: 'Compliance: Send documents by email', roles: ['admin'] },
  { id: 'portal.requests', label: 'Portal: View requests', roles: ['client'] },
  { id: 'portal.invoices', label: 'Portal: View invoices', roles: ['client'] },
  { id: 'portal.reports', label: 'Portal: View reports', roles: ['client'] },
];

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
  const [role, setRole] = useState<'admin' | 'operations' | 'factory' | 'client'>(
    (user?.role as 'admin' | 'operations' | 'factory' | 'client') || 'client',
  );
  const [clientId, setClientId] = useState(user?.clientId || presetClientId || clients[0]?.id || '');
  const [siteIds, setSiteIds] = useState<string[]>(user?.siteIds ?? []);
  const [factoryIds, setFactoryIds] = useState<string[]>(user?.factoryIds ?? []);
  const [active, setActive] = useState(user?.active !== false);
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean> | null>(
    user?.featureAccess ?? null,
  );
  const featuresForRole = FEATURE_FLAGS.filter((f) => f.roles.includes(role as 'admin' | 'operations' | 'factory' | 'client'));
  const restrictFeatures = featureAccess !== null;
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
          featureAccess,
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
          featureAccess,
        });
        onSaved(
          created.tempPassword
            ? `User created — password ${created.tempPassword}`
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
      okLabel={user ? 'Save User' : 'Create User'}
      busy={busy}
      onOk={() => void save()}
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
          <option value="admin">Super Admin</option>
          <option value="operations">Operations Manager</option>
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
        <p className="dim">Super Admins have full access to every client, site and factory.</p>
      ) : null}
      {role === 'operations' ? (
        <p className="dim">
          Operations Managers can acknowledge requests, manage vehicles &amp; weighments, and run reports. Other areas are
          read-only.
        </p>
      ) : null}

      {featuresForRole.length > 0 ? (
        <div className="fg">
          <label>
            Feature Access{' '}
            <span className="hint">
              restrict which features this user can see; leave unrestricted for full default access
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
            <input
              type="checkbox"
              checked={restrictFeatures}
              onChange={(e) => {
                if (e.target.checked) {
                  const init: Record<string, boolean> = {};
                  featuresForRole.forEach((f) => { init[f.id] = true; });
                  setFeatureAccess(init);
                } else {
                  setFeatureAccess(null);
                }
              }}
            />
            Enable custom restrictions for this user
          </label>
          {restrictFeatures ? (
            <div className="check-list">
              {featuresForRole.map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={featureAccess?.[f.id] === true}
                    onChange={(e) =>
                      setFeatureAccess((prev) => ({ ...prev, [f.id]: e.target.checked }))
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
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
          A welcome email is sent automatically. The sign-in password is <b className="mono">demo</b>.
        </div>
      )}
    </Modal>
  );
}
