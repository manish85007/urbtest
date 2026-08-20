import { useMemo, useState } from 'react';
import { dataApi, type HeroesAdminReport } from '../../api';
import { FileUpload } from '../../components/FileUpload';
import { Modal } from '../../components/Modal';
import { todayIso } from '../../lib/format';

interface PlantModalProps {
  asClient: boolean;
  clientName?: string;
  clientId?: string;
  clients?: HeroesAdminReport['clients'];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function PlantModal({ asClient, clientName, clientId, clients = [], onClose, onSaved }: PlantModalProps) {
  const initialCid = asClient ? clientId ?? '' : clientId || clients[0]?.id || '';
  const [cid, setCid] = useState(initialCid);
  const owed = useMemo(() => clients.find((c) => c.id === cid)?.owed ?? 0, [clients, cid]);
  const [trees, setTrees] = useState(asClient ? '' : String(owed || 1));
  const [plantedAt, setPlantedAt] = useState(todayIso());
  const [partner, setPartner] = useState('');
  const [location, setLocation] = useState('');
  const [state, setState] = useState('');
  const [species, setSpecies] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = parseInt(trees, 10);
    if (!n || n < 1) {
      setError('Enter how many trees were planted.');
      return;
    }
    if (!plantedAt) {
      setError('Planting date is required — CO₂ capture is measured from it.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dataApi.recordPlanting({
        trees: n,
        plantedAt,
        location,
        state,
        partner,
        species,
        photoFileId: photoIds[0],
        clientId: asClient ? undefined : cid,
        source: asClient ? 'client' : 'urbeno',
      });
      onSaved(`✓ ${n} tree${n > 1 ? 's' : ''} recorded`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record planting');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={asClient ? 'Log Your Own Tree Planting' : 'Record Tree Planting'}
      wide
      onClose={onClose}
      okLabel={asClient ? 'Log Planting' : 'Record Planting'}
      busy={busy}
      onOk={() => void save()}
    >
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.8rem' }}>
        {asClient
          ? 'Planted trees through your own CSR programme? Log them here so your Recycling Heroes page shows the full picture. These are recorded separately from the trees Urbeno plants against your recycled tonnage.'
          : "Log trees planted on a client's behalf. The client sees this on their Recycling Heroes page and gets a notification."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        {asClient ? (
          <div className="fg">
            <label htmlFor="tp-org">Organisation</label>
            <input id="tp-org" type="text" value={clientName ?? ''} disabled />
          </div>
        ) : (
          <div className="fg">
            <label htmlFor="tp-cid">Client *</label>
            <select
              id="tp-cid"
              value={cid}
              onChange={(e) => {
                const next = e.target.value;
                setCid(next);
                const nextOwed = clients.find((c) => c.id === next)?.owed ?? 0;
                setTrees(String(nextOwed || 1));
              }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="dim" style={{ fontSize: '.73rem', marginTop: '.2rem' }}>
              {owed ? `${owed} tree${owed > 1 ? 's' : ''} outstanding` : 'up to date'}
            </div>
          </div>
        )}
        <div className="fg">
          <label htmlFor="tp-n">Number of Trees *</label>
          <input
            id="tp-n"
            type="number"
            min={1}
            value={trees}
            placeholder="e.g. 25"
            onChange={(e) => setTrees(e.target.value)}
          />
        </div>
        <div className="fg">
          <label htmlFor="tp-dt">Planting Date *</label>
          <input
            id="tp-dt"
            type="date"
            value={plantedAt}
            max={todayIso()}
            onChange={(e) => setPlantedAt(e.target.value)}
          />
          <div className="dim" style={{ fontSize: '.71rem', marginTop: '.2rem' }}>
            CO₂ capture accrues daily from this date
          </div>
        </div>
        <div className="fg">
          <label htmlFor="tp-p">{asClient ? 'Drive / Programme' : 'Planting Partner'}</label>
          <input
            id="tp-p"
            type="text"
            value={partner}
            placeholder={asClient ? 'e.g. World Environment Day drive' : 'e.g. Say Trees Foundation'}
            onChange={(e) => setPartner(e.target.value)}
          />
        </div>
        <div className="fg">
          <label htmlFor="tp-pl">Location</label>
          <input
            id="tp-pl"
            type="text"
            value={location}
            placeholder="Village / area"
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="fg">
          <label htmlFor="tp-st">State</label>
          <input
            id="tp-st"
            type="text"
            value={state}
            placeholder="Karnataka"
            onChange={(e) => setState(e.target.value)}
          />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="tp-sp">
          Species <span className="hint">optional</span>
        </label>
        <input
          id="tp-sp"
          type="text"
          value={species}
          placeholder="e.g. Neem, Pongamia, mixed native"
          onChange={(e) => setSpecies(e.target.value)}
        />
      </div>
      <div className="section-hd" style={{ marginTop: '.3rem' }}>
        Planting-day Photo{' '}
        <span className="hint" style={{ fontWeight: 400 }}>
          optional — growth photos are added later
        </span>
      </div>
      <FileUpload
        kind="planting"
        label="📷 Attach photo"
        accept="image/jpeg,image/png,image/webp"
        value={photoIds}
        onChange={(ids) => setPhotoIds(ids.slice(-1))}
      />
    </Modal>
  );
}
