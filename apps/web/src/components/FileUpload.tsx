import { useRef, useState } from 'react';
import { filesApi } from '../api';

export type UploadKind =
  | 'weighPhoto'
  | 'pickPhoto'
  | 'certificate'
  | 'bom'
  | 'invoice'
  | 'eway'
  | 'serials'
  | 'processing'
  | 'report'
  | 'logo'
  | 'planting';

interface FileUploadProps {
  kind: UploadKind;
  label: string;
  hint?: string;
  accept?: string;
  /** Hint mobile browsers to open the camera for image capture. */
  capture?: boolean | 'user' | 'environment';
  disabled?: boolean;
  required?: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
}

export function FileUpload({
  kind,
  label,
  hint,
  accept,
  capture,
  disabled,
  required,
  value,
  onChange,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});

  async function onPick(files: FileList | null) {
    if (!files?.length || disabled) return;
    setBusy(true);
    setError('');
    try {
      const uploaded: string[] = [];
      const nextNames = { ...names };
      for (const file of Array.from(files)) {
        const rec = await filesApi.upload(file, kind);
        uploaded.push(rec.id);
        nextNames[rec.id] = rec.name;
      }
      setNames(nextNames);
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="file-upload">
      <label className="file-upload-label">
        {label}
        {required ? ' *' : ''}
      </label>
      {hint ? <p className="hint">{hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture === true ? 'environment' : capture || undefined}
        multiple
        disabled={disabled || busy}
        onChange={(e) => void onPick(e.target.files)}
      />
      {value.length > 0 ? (
        <ul className="file-list">
          {value.map((id) => (
            <li key={id}>
              <span>{names[id] ?? id.slice(0, 8)}</span>
              <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => remove(id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {busy ? <p className="muted sm">Uploading…</p> : null}
      {error ? <p className="error sm">{error}</p> : null}
    </div>
  );
}
