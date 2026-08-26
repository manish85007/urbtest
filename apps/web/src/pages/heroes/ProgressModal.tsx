import { useState } from 'react';
import { dataApi, type HeroesPlanting } from '../../api';
import { FileUpload } from '../../components/FileUpload';
import { DateField } from '../../components/DateField';
import { Modal } from '../../components/Modal';
import { daysBetween, fmtDate, todayIso } from '../../lib/format';

interface ProgressModalProps {
  planting: HeroesPlanting;
  onClose: () => void;
  onSaved: () => void;
}

export function ProgressModal({ planting: t, onClose, onSaved }: ProgressModalProps) {
  const days = daysBetween(t.plantedAt);
  const [notedAt, setNotedAt] = useState(todayIso());
  const [note, setNote] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!notedAt) {
      setError('Photo date is required.');
      return;
    }
    if (notedAt < t.plantedAt) {
      setError('The photo cannot pre-date the planting.');
      return;
    }
    if (notedAt > todayIso()) {
      setError('Photo date cannot be in the future.');
      return;
    }
    if (!photoIds[0]) {
      setError('Attach the photo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dataApi.addTreeProgress(t.id, { notedAt, photoFileId: photoIds[0], note });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add photo');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Growth Photo — ${t.trees} tree${t.trees > 1 ? 's' : ''} at ${t.location || 'partner site'}`}
      onClose={onClose}
      okLabel="Add to Timeline"
      busy={busy}
      onOk={() => void save()}
    >
      <p className="dim" style={{ fontSize: '.82rem', marginBottom: '.8rem' }}>
        Planted {fmtDate(t.plantedAt)}, {days} days ago. Add a dated photo so the CSR activity has a verifiable
        audit trail.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="fr2">
        <DateField
          id="pg-dt"
          label="Photo Date *"
          value={notedAt}
          min={t.plantedAt}
          max={todayIso()}
          onChange={setNotedAt}
        />
        <div className="fg">
          <label htmlFor="pg-n">Existing checks</label>
          <input id="pg-n" type="text" value={`${t.progress.length} on record`} disabled />
        </div>
      </div>
      <div className="fg">
        <label htmlFor="pg-note">
          Observation <span className="hint">what the photo shows</span>
        </label>
        <input
          id="pg-note"
          type="text"
          value={note}
          placeholder="e.g. 6 months — average height 1.6 m, all saplings alive"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="section-hd" style={{ marginTop: '.3rem' }}>
        Photo * <span className="hint" style={{ fontWeight: 400 }}>JPEG / PNG / WebP — take or choose a picture</span>
      </div>
      <FileUpload
        kind="planting"
        label="📷 Take or upload photo"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        required
        value={photoIds}
        onChange={(ids) => setPhotoIds(ids.slice(-1))}
      />
    </Modal>
  );
}
