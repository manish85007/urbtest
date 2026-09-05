import { useEffect, useState } from 'react';
import { dataApi, type ClientSummary, type FactorySummary, type SiteSummary, type UserRow } from '../../api';
import { Modal } from '../../components/Modal';
import { isClientPortalRole } from '@urb-tectrack/shared';

type FormRole = 'admin' | 'operations' | 'factory' | 'client' | 'client_readonly' | 'auditor';

const FEATURE_FLAGS: Array<{ id: string; label: string; roles: FormRole[] }> = [
  { id: 'reports.summary', label: 'Report: Request Summary', roles: ['admin', 'operations', 'auditor'] },
  { id: 'reports.complete', label: 'Report: Complete Request Summary', roles: ['admin', 'operations', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.invoices', label: 'Report: Invoice Register', roles: ['admin', 'operations', 'auditor'] },
  { id: 'reports.sustain', label: 'Report: Sustainability', roles: ['admin', 'operations', 'auditor'] },
  { id: 'reports.heroes', label: 'Report: Recycling Heroes', roles: ['admin', 'operations', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.mrn', label: 'Report: MRN Register', roles: ['factory'] },
  { id: 'reports.form6', label: 'Report: Form 6 Log', roles: ['factory', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.serials', label: 'Report: Device Serials', roles: ['admin', 'operations', 'factory', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.cod', label: 'Report: Certificate Log', roles: ['factory', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.category', label: 'Report: Category Recovery', roles: ['factory', 'client', 'client_readonly', 'auditor'] },
  { id: 'reports.capacity', label: 'Report: Capacity Utilisation', roles: ['factory'] },
  { id: 'compliance.email', label: 'Compliance: Send documents by email', roles: ['admin'] },
  { id: 'portal.requests', label: 'Portal: View requests', roles: ['client', 'client_readonly'] },
  { id: 'portal.invoices', label: 'Portal: View invoices', roles: ['client', 'client_readonly'] },
  { id: 'portal.reports', label: 'Portal: View reports', roles: ['client', 'client_readonly'] },
  { id: 'portal.heroes', label: 'Portal: Recycling Heroes', roles: ['client', 'client_readonly'] },
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
  const [role, setRole] = useState<FormRole>((user?.role as FormRole) || 'client');
  const [clientId, setClientId] = useState(user?.clientId || presetClientId || clients[0]?.id || '');
  const [siteIds, setSiteIds] = useState<string[]>(user?.siteIds ?? []);
  const [factoryIds, setFactoryIds] = useState<string[]>(user?.factoryIds ?? []);
  const [active, setActive] = useState(user?.active !== false);
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean> | null>(
    user?.featureAccess ?? null,
  );
  const featuresForRole = FEATURE_FLAGS.filter((f) => f.roles.includes(role));
  const restrictFeatures = featureAccess !== null;
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState<{
    tempPassword: string;
    emailSent: boolean;
  } | null>(null);

  const portalRole = isClientPortalRole(role);

  useEffect(() => {
    if (!portalRole || !clientId) {
      setSites([]);
      return;
    }
    dataApi.sites(clientId, true).then(setSites).catch(() => setSites([]));
  }, [portalRole, clientId]);

  function toggle(list: string[], id: string, on: boolean) {
    return on ? [...list, id] : list.filter((x) => x !== id);
  }

  async function resetPassword() {
    if (!user) return;
    const ok = window.confirm(
      `Reset password for ${user.name} (${user.email})?\n\nA new temporary password will be generated. Share it with the user securely — useful when email delivery is unavailable.`,
    );
    if (!ok) return;
    setError('');
    setResetResult(null);
    setResetBusy(true);
    try {
      const res = await dataApi.resetUserPassword(user.id);
      setResetResult({ tempPassword: res.tempPassword, emailSent: res.emailSent });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setResetBusy(false);
    }
  }

  async function save() {
    setError('');
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (portalRole && !clientId) {
      setError('Select which client this user belongs to.');
      return;
    }
    if ((role === 'admin' || role === 'operations' || role === 'factory' || role === 'auditor') && email.trim() && !/@urbeno\.in$/i.test(email.trim())) {
      setError('Urbeno staff and auditor accounts must use an @urbeno.in email.');
      return;
    }
    setBusy(true);
    try {
      if (user) {
        await dataApi.updateUser(user.id, {
          name,
          role,
          clientId: portalRole ? clientId : null,
          siteIds: portalRole ? siteIds : [],
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
          clientId: portalRole ? clientId : null,
          siteIds: portalRole ? siteIds : [],
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
        <select value={role} onChange={(e) => setRole(e.target.value as FormRole)}>
          <option value="client">Client User</option>
          <option value="client_readonly">Client Read Only</option>
          <option value="admin">Super Admin</option>
          <option value="operations">Operations Manager</option>
          <option value="factory">Factory Manager</option>
          <option value="auditor">Auditor (Urbeno, read-only)</option>
        </select>
      </label>
      {portalRole ? (
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
      {role === 'client_readonly' ? (
        <p className="dim">
          Client Read Only can view requests, Recycling Heroes, and download Form 6 / Certificate of Destruction. They
          cannot raise or close requests, log CSR plantings, or receive new-request email notifications.
        </p>
      ) : null}
      {role === 'auditor' ? (
        <p className="dim">
          Auditors must use an @urbeno.in email. Access is organisation-wide and read-only (including Audit and Compliance
          views). Masters and lifecycle edits are not available.
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
        <>
          <label>
            Status
            <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </select>
          </label>
          <div className="note-box" style={{ marginTop: '.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '.35rem' }}>Password reset</div>
            <p className="dim" style={{ fontSize: '.82rem', margin: '0 0 .5rem' }}>
              Generate a new temporary password for this user when they cannot receive email OTPs. Existing sessions
              are signed out immediately.
            </p>
            <button
              type="button"
              className="btn"
              disabled={resetBusy || busy}
              onClick={() => void resetPassword()}
            >
              {resetBusy ? 'Resetting…' : 'Reset / regenerate password'}
            </button>
            {resetResult ? (
              <div
                className="note-box"
                style={{ marginTop: '.6rem', background: 'var(--bl2)', color: 'var(--bl)' }}
              >
                <div>
                  Temporary password:{' '}
                  <b className="mono" style={{ userSelect: 'all' }}>
                    {resetResult.tempPassword}
                  </b>
                </div>
                <div style={{ fontSize: '.8rem', marginTop: '.25rem' }}>
                  {resetResult.emailSent
                    ? 'A copy was also emailed to the user (if mail delivery is working).'
                    : 'Email was not confirmed — share this password with the user out-of-band.'}
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: '.45rem' }}
                  onClick={() => void navigator.clipboard.writeText(resetResult.tempPassword)}
                >
                  Copy password
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="note-box" style={{ background: 'var(--bl2)', color: 'var(--bl)' }}>
          A welcome email is sent automatically with a temporary password. The user must set a new password on first sign-in.
        </div>
      )}
    </Modal>
  );
}
