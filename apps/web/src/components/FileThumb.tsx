import { filesApi } from '../api';

const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

export function FileThumb({
  id,
  name,
  kind,
}: {
  id: string;
  name?: string;
  kind?: 'image' | 'doc';
}) {
  const url = filesApi.url(id);
  const isImage = kind === 'image' || (kind !== 'doc' && (!name || IMAGE_RE.test(name)));

  return (
    <a className="fthumb" href={url} target="_blank" rel="noopener noreferrer">
      {isImage ? <img src={url} alt={name || 'Attachment'} /> : <span className="fthumb-d">📄</span>}
      {name ? <span className="fthumb-n">{name}</span> : null}
    </a>
  );
}

export function FileRow({
  ids,
  kind,
  empty = 'none',
}: {
  ids?: string[] | null;
  kind?: 'image' | 'doc';
  empty?: string;
}) {
  if (!ids?.length) {
    return <span className="dim" style={{ fontSize: '.75rem' }}>{empty}</span>;
  }
  return (
    <div className="frow">
      {ids.map((id) => (
        <FileThumb key={id} id={id} kind={kind} />
      ))}
    </div>
  );
}
