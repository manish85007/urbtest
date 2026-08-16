import { useState } from 'react';
import { dataApi, type FactorySummary, type UserRow } from '../../api';
import { Modal } from '../../components/Modal';

interface FactoriesTabProps {
  factories: FactorySummary[];
  users: UserRow[];
  onChanged: (msg: string) => void;
}

export function FactoriesTab({ factories, users, onChanged }: FactoriesTabProps) {
  const [editing, setEditing] = useState<FactorySummary | null | undefined>(undefined);

  return (
    <>
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl">Urbeno Factory Sites ({factories.length})</div>
          <div className="spacer" />
          <button type="button" className="btn bp bsm" onClick={() => setEditing(null)}>
            + New Factory Site
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Facility</th>
                <th>GST</th>
                <th>KSPCB Consent</th>
                <th>CPCB / EPR Authorisation</th>
                <th>Approved TPA</th>
                <th>Manager</th>
                <th>MRNs</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => {
                const mgr = users.find((u) => u.email === f.managerEmail);
                return (
                  <tr key={f.id} style={f.active === false ? { opacity: 0.55 } : undefined}>
                    <td>
                      <span className="badge bg-pu mono">
                        <b>{f.id}</b>
                      </span>
                    </td>
                    <td>
                      <b>{f.name}</b>
                      <div className="dim" style={{ fontSize: '.72rem' }}>
                        {(f.address || '').slice(0, 55)}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '.75rem' }}>
                      {f.gstin || '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '.72rem' }}>
                      {f.kspcbConsent || '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '.72rem' }}>
                      {f.cpcbEpr || '—'}
                    </td>
                    <td className="mono">
                      {f.categoryLines ? (
                        <>
                          {Number(f.approvedTpa ?? 0).toLocaleString()}
                          <div className="dim" style={{ fontSize: '.7rem' }}>
                            {f.categoryLines} lines
                          </div>
                        </>
                      ) : (
                        <span className="dim">not set</span>
                      )}
                    </td>
                    <td className="dim">{mgr?.name || f.managerEmail || '—'}</td>
                    <td className="mono">{f.mrnCount ?? 0}</td>
                    <td>
                      <button type="button" className="btn bs bsm" onClick={() => setEditing(f)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="note-box">
          MRN numbers are sequenced per factory and reset every April — format{' '}
          <b className="mono">MRN/[Factory]/[FY]/[0001]</b>. Approved capacity is held per facility
          in the Category Master, so each site is measured against its own consent order.
        </div>
      </div>
      {editing !== undefined ? (
        <FactoryModal
          factory={editing}
          users={users}
          onClose={() => setEditing(undefined)}
          onSaved={onChanged}
        />
      ) : null}
    </>
  );
}

function FactoryModal({
  factory,
  users,
  onClose,
  onSaved,
}: {
  factory: FactorySummary | null;
  users: UserRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const mgrs = users.filter((u) => u.role === 'factory' || u.role === 'admin');
  const [id, setId] = useState(factory?.id ?? '');
  const [name, setName] = useState(factory?.name ?? '');
  const [address, setAddress] = useState(factory?.address ?? '');
  const [gstin, setGstin] = useState(factory?.gstin ?? '');
  const [kspcb, setKspcb] = useState(factory?.kspcbConsent ?? '');
  const [cpcb, setCpcb] = useState(factory?.cpcbEpr ?? '');
  const [managerEmail, setManagerEmail] = useState(factory?.managerEmail ?? '');
  const [active, setActive] = useState(factory?.active !== false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    if (!name.trim() || !address.trim()) {
      setError('Facility name and address are required.');
      return;
    }
    if (!factory && !id.trim()) {
      setError('Factory code is required.');
      return;
    }
    setBusy(true);
    try {
      await dataApi.upsertFactory({
        id: factory?.id ?? id,
        name,
        address,
        gstin,
        kspcbConsent: kspcb,
        cpcbEpr: cpcb,
        managerEmail: managerEmail || undefined,
        active: factory ? active : true,
      });
      onSaved(factory ? 'Factory updated.' : 'Factory created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={factory ? `Edit Factory — ${factory.id}` : 'New Factory Site'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn bs" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn bp" disabled={busy} onClick={() => void save()}>
            {factory ? 'Save Factory' : 'Create Factory'}
          </button>
        </>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <label>
          Factory Code *
          <input
            className="mono"
            value={id}
            disabled={!!factory}
            style={{ textTransform: 'uppercase' }}
            placeholder="URB-XYZ"
            onChange={(e) => setId(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Facility Name *
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <label>
        Address *
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <div className="fr2">
        <label>
          GST Number
          <input className="mono" style={{ textTransform: 'uppercase' }} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
        </label>
        <label>
          KSPCB Consent Reference
          <input value={kspcb} onChange={(e) => setKspcb(e.target.value)} />
        </label>
      </div>
      <label>
        CPCB / EPR Authorisation Number
        <input className="mono" value={cpcb} onChange={(e) => setCpcb(e.target.value)} placeholder="CPCB/EPR/RECYCLER/2025/KA/00000" />
        <div className="dim" style={{ fontSize: '.71rem', marginTop: '.2rem' }}>
          Printed on Form 6 and the MRN issued from this facility
        </div>
      </label>
      <label>
        Factory Manager
        <select value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)}>
          <option value="">— unassigned —</option>
          {mgrs.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </label>
      {factory ? (
        <label>
          Status
          <select value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
      ) : null}
    </Modal>
  );
}
