import { SUSTAINABILITY } from '@urb-tectrack/shared';
import { filesApi, type HeroesPlanting } from '../../api';
import { daysBetween, fmtDate, num } from '../../lib/format';

interface TreeCardProps {
  planting: HeroesPlanting;
  canEdit: boolean;
  showClientCsrProgress?: boolean;
  clientVariant?: boolean;
  onAddProgress: (planting: HeroesPlanting) => void;
  onRemove?: (planting: HeroesPlanting) => void;
  onRemoveProgress?: (planting: HeroesPlanting, progressId: string) => void;
}

export function TreeCard({
  planting: t,
  canEdit,
  showClientCsrProgress,
  clientVariant,
  onAddProgress,
  onRemove,
  onRemoveProgress,
}: TreeCardProps) {
  const pg = t.progress ?? [];
  const days = daysBetween(t.plantedAt);
  const co2 = days * t.trees * SUSTAINABILITY.co2PerTreeDay;
  const isClientSrc = t.source === 'client';
  const showProgressBtn = canEdit || (showClientCsrProgress && isClientSrc);

  return (
    <div className={`sub-card${clientVariant ? ' heroes-tree-card' : ''}`}>
      <div className="sub-card-hd">
        <b style={{ fontSize: '.92rem' }}>
          {t.trees} tree{t.trees > 1 ? 's' : ''}
        </b>
        <span className={`badge ${isClientSrc ? 'bg-pu' : 'bg-g'}`}>
          {isClientSrc ? 'Client CSR' : 'Planted by Urbeno'}
        </span>
        <span className="badge bg-gy">{fmtDate(t.plantedAt)}</span>
        <span className="badge bg-bl">
          {days} days · {num(co2)} kg CO₂ captured
        </span>
        <div className="spacer" />
        {showProgressBtn ? (
          <button type="button" className="btn bs bsm" onClick={() => onAddProgress(t)}>
            📷 Add growth photo
          </button>
        ) : null}
        {canEdit && onRemove ? (
          <button type="button" className="btn brd bsm" onClick={() => onRemove(t)}>
            ×
          </button>
        ) : null}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
          gap: '.4rem',
          marginBottom: '.45rem',
        }}
      >
        <div className="tile">
          <div className="tile-l">Location</div>
          <div className="tile-v">{t.location || '—'}</div>
          {t.state ? (
            <div className="dim" style={{ fontSize: '.7rem' }}>
              {t.state}
            </div>
          ) : null}
        </div>
        <div className="tile">
          <div className="tile-l">Partner / Drive</div>
          <div className="tile-v">{t.partner || '—'}</div>
        </div>
        {t.species ? (
          <div className="tile">
            <div className="tile-l">Species</div>
            <div className="tile-v">{t.species}</div>
          </div>
        ) : null}
        <div className="tile">
          <div className="tile-l">Absorbing</div>
          <div className="tile-v">{(t.trees * SUSTAINABILITY.co2PerTreeDay).toFixed(3)} kg/day</div>
        </div>
      </div>
      {t.photoFileId ? (
        <div className="fattachment-list">
          <a
            className="fattachment has-preview"
            href={filesApi.url(t.photoFileId)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open planting photo"
          >
            <img
              className="fattachment-preview"
              src={filesApi.url(t.photoFileId, { stream: true })}
              alt="Planting day"
            />
            <span className="fattachment-meta">
              <span className="fattachment-label">Planting photo</span>
              <span className="fattachment-action">Open</span>
            </span>
          </a>
        </div>
      ) : null}
      <div style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--g2)', margin: '.3rem 0 .25rem' }}>
        Growth timeline {pg.length ? `(${pg.length} check${pg.length > 1 ? 's' : ''})` : ''}
      </div>
      {!pg.length ? (
        <div className="dim" style={{ fontSize: '.76rem' }}>
          No growth photos yet — these build the audit trail for the CSR activity.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '.5rem', overflowX: 'auto', paddingBottom: '.2rem' }} className={clientVariant ? 'heroes-growth-row' : undefined}>
          {pg.map((p) => {
            const d = daysBetween(t.plantedAt, new Date(p.notedAt));
            return (
              <div
                key={p.id}
                className={clientVariant ? 'heroes-growth-photo' : undefined}
                style={
                  clientVariant
                    ? undefined
                    : {
                        minWidth: 132,
                        maxWidth: 132,
                        border: '1px solid var(--bd)',
                        borderRadius: 8,
                        padding: '.35rem',
                        background: '#fff',
                      }
                }
              >
                <div className="frow" style={{ marginBottom: '.2rem' }}>
                  {p.photoFileId ? (
                    <a className="fthumb" href={filesApi.url(p.photoFileId)} target="_blank" rel="noopener noreferrer">
                      <img src={filesApi.url(p.photoFileId, { stream: true })} alt="" />
                    </a>
                  ) : (
                    <div className="fthumb">
                      <span className="dim" style={{ fontSize: '.6rem' }}>
                        no image
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '.71rem', fontWeight: 700, color: 'var(--g2)' }}>{fmtDate(p.notedAt)}</div>
                <div className="dim" style={{ fontSize: '.66rem' }}>
                  day {d} after planting
                </div>
                {p.note ? (
                  <div style={{ fontSize: '.68rem', marginTop: '.15rem', lineHeight: 1.35 }}>{p.note}</div>
                ) : null}
                {canEdit && onRemoveProgress ? (
                  <button
                    type="button"
                    className="btn brd bsm"
                    style={{ marginTop: '.2rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => onRemoveProgress(t, p.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
