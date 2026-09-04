import { useState } from 'react';
import { filesApi } from '../api';

const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

export function FileThumb({
  id,
  name,
  kind,
  index = 1,
}: {
  id: string;
  name?: string;
  kind?: 'image' | 'doc';
  index?: number;
}) {
  const openUrl = filesApi.url(id);
  const previewUrl = filesApi.url(id, { stream: true });
  const label = name?.trim() || `Attachment ${index}`;
  const preferImage = kind === 'image' || (kind !== 'doc' && IMAGE_RE.test(name || ''));
  const [imgFailed, setImgFailed] = useState(false);
  const showPreview = preferImage && !imgFailed;

  return (
    <a
      className={`fattachment${showPreview ? ' has-preview' : ''}`}
      href={openUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${label}`}
    >
      {showPreview ? (
        <img
          className="fattachment-preview"
          src={previewUrl}
          alt=""
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="fattachment-icon" aria-hidden>
          📎
        </span>
      )}
      <span className="fattachment-meta">
        <span className="fattachment-label">{label}</span>
        <span className="fattachment-action">Open</span>
      </span>
    </a>
  );
}

export function FileRow({
  ids,
  kind,
  empty = 'none',
  labelPrefix = 'Attachment',
}: {
  ids?: string[] | null;
  kind?: 'image' | 'doc';
  empty?: string;
  /** Label prefix when listing unnamed files (default: Attachment). */
  labelPrefix?: string;
}) {
  if (!ids?.length) {
    return (
      <span className="dim" style={{ fontSize: '.75rem' }}>
        {empty}
      </span>
    );
  }
  return (
    <div className="fattachment-list">
      {ids.map((id, i) => (
        <FileThumb
          key={id}
          id={id}
          kind={kind}
          index={i + 1}
          name={`${labelPrefix} ${i + 1}`}
        />
      ))}
    </div>
  );
}
