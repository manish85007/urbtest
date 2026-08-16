import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_GROUPS } from '@urb-tectrack/shared';
import { dataApi, type CategorySummary, type FactorySummary } from '../../api';
import { Modal } from '../../components/Modal';

interface CategoriesTabProps {
  factories: FactorySummary[];
  onChanged: (msg: string) => void;
}

export function CategoriesTab({ factories, onChanged }: CategoriesTabProps) {
  const [factoryId, setFactoryId] = useState(factories[0]?.id ?? '');
  const [rows, setRows] = useState<CategorySummary[]>([]);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [activity, setActivity] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CategorySummary | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!factoryId && factories[0]) setFactoryId(factories[0].id);
  }, [factories, factoryId]);

  async function load() {
    if (!factoryId) return;
    try {
      setRows(await dataApi.categories(factoryId, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }

  useEffect(() => {
    void load();
  }, [factoryId]);

  const fac = factories.find((f) => f.id === factoryId);
  const activeRows = rows.filter((c) => c.active !== false);
  const rec = activeRows.filter((c) => c.activity !== 'Refurbishment').reduce((s, c) => s + Number(c.capacityTpa), 0);
  const ref = activeRows.filter((c) => c.activity === 'Refurbishment').reduce((s, c) => s + Number(c.capacityTpa), 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (!showInactive && c.active === false) return false;
      if (group && c.groupCode !== group) return false;
      if (activity && (c.activity || 'Recycling') !== activity) return false;
      if (needle && !`${c.entryId} ${c.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, group, activity, showInactive]);

  async function toggle(c: CategorySummary, on: boolean) {
    if (!on && !confirm(`Deactivate ${c.entryId}? It will not appear for new categorization. Existing records are unaffected.`)) {
      return;
    }
    try {
      await dataApi.patchCategory(c.id, { active: on });
      onChanged(on ? 'Category activated.' : 'Category deactivated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <>
      <div className="card" style={{ background: 'var(--g3)', borderColor: 'var(--g4)' }}>
        <div className="f-row" style={{ alignItems: 'center' }}>
          <label style={{ margin: 0, minWidth: 250 }}>
            Authorization held by
            <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.id})
                </option>
              ))}
            </select>
          </label>
          <div className="spacer" />
          <div style={{ fontSize: '.78rem', color: 'var(--g2)', textAlign: 'right' }}>
            <div>
              KSPCB <b className="mono">{fac?.kspcbConsent || '—'}</b>
            </div>
            <div>
              CPCB/EPR <b className="mono">{fac?.cpcbEpr || '—'}</b>
            </div>
          </div>
          <Link className="btn bs bsm" to="/capacity">
            Capacity →
          </Link>
        </div>
      </div>
      <div className="stats" style={{ marginBottom: '.8rem' }}>
        <div className="stat">
          <div className="stat-l">Active Entries</div>
          <div className="stat-v">{activeRows.length}</div>
          <div className="stat-t">at this facility</div>
        </div>
        <div className="stat">
          <div className="stat-l">Recycling</div>
          <div className="stat-v">{rec.toLocaleString()}</div>
          <div className="stat-t">TPA</div>
        </div>
        <div className="stat">
          <div className="stat-l">Refurbishment</div>
          <div className="stat-v">{ref.toLocaleString()}</div>
          <div className="stat-t">TPA</div>
        </div>
        <div className="stat">
          <div className="stat-l">Total Authorized</div>
          <div className="stat-v">{(rec + ref).toLocaleString()}</div>
          <div className="stat-t">TPA at this facility</div>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="card">
        <div className="fr4">
          <label>
            Search
            <input value={q} placeholder="Entry ID or description" onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            Group
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">All groups</option>
              {Object.entries(CATEGORY_GROUPS).map(([k, g]) => (
                <option key={k} value={k}>
                  {k} — {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activity
            <select value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="">All</option>
              <option value="Recycling">Recycling</option>
              <option value="Refurbishment">Refurbishment</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-end', fontWeight: 400, fontSize: '.83rem' }}>
            <span>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show
              inactive
            </span>
          </label>
        </div>
        <button type="button" className="btn bp bsm" onClick={() => setEditing(null)}>
          + Add Category
        </button>
      </div>
      <div className="card" style={{ padding: '.4rem' }}>
        <div className="dim" style={{ fontSize: '.78rem', padding: '.3rem .5rem' }}>
          Showing {filtered.length} authorization lines for {fac?.name ?? factoryId}
        </div>
        <div className="tw" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Entry ID</th>
                <th>Description</th>
                <th>Group</th>
                <th>Activity</th>
                <th style={{ textAlign: 'right' }}>TPA</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={c.active === false ? { opacity: 0.5 } : undefined}>
                  <td className="mono">
                    <b>{c.entryId}</b>
                  </td>
                  <td style={{ fontSize: '.82rem' }}>{c.description}</td>
                  <td>
                    <span className="badge bg-bl">{c.groupCode}</span>
                  </td>
                  <td>
                    {c.activity === 'Refurbishment' ? (
                      <span className="badge bg-am">Refurb</span>
                    ) : (
                      <span className="badge bg-g">Recycling</span>
                    )}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    <b>{c.capacityTpa}</b>
                  </td>
                  <td>
                    {c.active !== false ? (
                      <span className="badge bg-g">Active</span>
                    ) : (
                      <span className="badge bg-gy">Inactive</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn bs bsm" onClick={() => setEditing(c)}>
                      Edit
                    </button>{' '}
                    <button
                      type="button"
                      className={`btn bsm ${c.active !== false ? 'brd' : 'bg-btn'}`}
                      onClick={() => void toggle(c, c.active === false)}
                    >
                      {c.active !== false ? 'Off' : 'On'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing !== undefined ? (
        <CategoryModal
          factories={factories}
          factoryId={factoryId}
          category={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (msg) => {
            onChanged(msg);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function CategoryModal({
  factories,
  factoryId,
  category,
  onClose,
  onSaved,
}: {
  factories: FactorySummary[];
  factoryId: string;
  category: CategorySummary | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [facId, setFacId] = useState(category?.id ? undefined : factoryId);
  const [entryId, setEntryId] = useState(category?.entryId ?? '');
  const [capacityTpa, setCapacityTpa] = useState(category?.capacityTpa ?? '');
  const [groupCode, setGroupCode] = useState(category?.groupCode ?? 'ITEW');
  const [activity, setActivity] = useState(category?.activity ?? 'Recycling');
  const [description, setDescription] = useState(category?.description ?? '');
  const [authRef, setAuthRef] = useState(category?.authRef ?? factories.find((f) => f.id === factoryId)?.cpcbEpr ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    const cap = Number(capacityTpa);
    if (!description.trim() || !Number.isFinite(cap)) {
      setError('Description and capacity are required.');
      return;
    }
    setBusy(true);
    try {
      if (category) {
        await dataApi.patchCategory(category.id, {
          description,
          groupCode,
          capacityTpa: cap,
          activity,
          authRef,
        });
        onSaved('Category updated.');
      } else {
        await dataApi.upsertCategory({
          factoryId: facId || factoryId,
          entryId: entryId.trim().toUpperCase(),
          description,
          groupCode,
          capacityTpa: cap,
          activity,
          authRef,
        });
        onSaved('Category added.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={category ? `Edit ${category.entryId}` : 'Add Authorization Line'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn bs" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn bp" disabled={busy} onClick={() => void save()}>
            {category ? 'Save Category' : 'Add Category'}
          </button>
        </>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      <label>
        Facility *
        <select value={facId || factoryId} disabled={!!category} onChange={(e) => setFacId(e.target.value)}>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.id})
            </option>
          ))}
        </select>
        <div className="dim" style={{ fontSize: '.71rem', marginTop: '.2rem' }}>
          Capacity is authorized per facility — the same entry ID can exist at more than one site
        </div>
      </label>
      <div className="fr2">
        <label>
          Entry ID *
          <input
            className="mono"
            value={entryId}
            disabled={!!category}
            placeholder="REC-ITEW28"
            style={{ textTransform: 'uppercase' }}
            onChange={(e) => setEntryId(e.target.value.toUpperCase())}
          />
          <div className="dim" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>
            REC- for recycling, REF- for refurbishment
          </div>
        </label>
        <label>
          Capacity (TPA) *
          <input type="number" step="0.1" value={capacityTpa} onChange={(e) => setCapacityTpa(e.target.value)} />
        </label>
        <label>
          Material Group *
          <select value={groupCode} onChange={(e) => setGroupCode(e.target.value)}>
            {Object.entries(CATEGORY_GROUPS).map(([k, g]) => (
              <option key={k} value={k}>
                {k} — {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity *
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="Recycling">Recycling</option>
            <option value="Refurbishment">Refurbishment</option>
          </select>
        </label>
      </div>
      <label>
        Description *
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Authorization Reference
        <input value={authRef} onChange={(e) => setAuthRef(e.target.value)} />
      </label>
    </Modal>
  );
}
