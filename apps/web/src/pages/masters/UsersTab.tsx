import { useState } from 'react';
import type { ClientSummary, FactorySummary, UserRow } from '../../api';
import { roleBadgeClass, roleLabel } from '../../lib/roles';
import { UserFormModal } from './UserFormModal';

interface UsersTabProps {
  users: UserRow[];
  clients: ClientSummary[];
  factories: FactorySummary[];
  onChanged: (msg: string) => void;
}

function scopeLabel(u: UserRow, clients: ClientSummary[], factories: FactorySummary[]) {
  if (u.role === 'admin') return 'full access';
  if (u.role === 'operations') return 'ack · vehicles · reports';
  if (u.role === 'factory') {
    if (!u.factoryIds.length) return 'all factories';
    return u.factoryIds.map((id) => factories.find((f) => f.id === id)?.name ?? id).join(', ');
  }
  const client = clients.find((c) => c.id === u.clientId)?.name ?? u.clientId ?? '—';
  const sites = u.siteIds?.length ? ` · ${u.siteIds.length} site(s)` : ' · all sites';
  return client + sites;
}

export function UsersTab({ users, clients, factories, onChanged }: UsersTabProps) {
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);

  return (
    <>
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Users ({users.length})</div>
          <div className="spacer" />
          <button type="button" className="btn bp bsm" onClick={() => setEditing(null)}>
            + New User
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Scope</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={u.active === false ? { opacity: 0.55 } : undefined}>
                  <td>
                    <b>{u.name}</b>
                  </td>
                  <td className="dim">{u.email}</td>
                  <td>
                    <span className={`badge ${roleBadgeClass(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="dim" style={{ fontSize: '.78rem' }}>
                    {scopeLabel(u, clients, factories)}
                  </td>
                  <td>
                    {u.active !== false ? (
                      <span className="badge bg-g">Active</span>
                    ) : (
                      <span className="badge bg-gy">Disabled</span>
                    )}
                  </td>
                  <td>
                      <button type="button" className="btn bs bsm" onClick={() => setEditing(u)}>
                        ✏️
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing !== undefined ? (
        <UserFormModal
          clients={clients}
          factories={factories}
          user={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(msg) => {
            setEditing(undefined);
            onChanged(msg);
          }}
        />
      ) : null}
    </>
  );
}
