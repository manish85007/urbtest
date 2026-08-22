import { formatDatePreview } from '../lib/datetime';

export interface DateFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  showPreview?: boolean;
  className?: string;
}

/** Universal date picker — native calendar with consistent styling across the app. */
export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  hint,
  showPreview = false,
  className,
}: DateFieldProps) {
  return (
    <div className={`fg date-field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="date-input"
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {showPreview && value ? (
        <div className="date-field-preview">{formatDatePreview(value)}</div>
      ) : null}
      {hint ? <p className="hint" style={{ textAlign: 'left' }}>{hint}</p> : null}
    </div>
  );
}
