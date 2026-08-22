import { useMemo } from 'react';
import {
  combineDateTime,
  formatDateTimePreview,
  localDateIso,
  splitDateTime,
} from '../lib/datetime';

const TIME_PRESETS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '6:00 PM', value: '18:00' },
];

export interface DateTimeFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (isoValue: string) => void;
  minDate?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  showPresets?: boolean;
}

/** Split date + time pickers — clearer than datetime-local and no extra confirm step. */
export function DateTimeField({
  id = 'dt',
  label,
  value,
  onChange,
  minDate,
  required,
  disabled,
  hint,
  showPresets = true,
}: DateTimeFieldProps) {
  const { date, time } = useMemo(() => splitDateTime(value), [value]);
  const preview = value ? formatDateTimePreview(value) : '';

  function updateDate(nextDate: string) {
    onChange(combineDateTime(nextDate, time || '09:00'));
  }

  function updateTime(nextTime: string) {
    const baseDate = date || minDate || localDateIso();
    onChange(combineDateTime(baseDate, nextTime));
  }

  return (
    <div className="fg date-time-field">
      <label htmlFor={`${id}-date`}>{label}</label>
      <div className="dt-split">
        <input
          id={`${id}-date`}
          className="date-input"
          type="date"
          value={date}
          min={minDate}
          required={required}
          disabled={disabled}
          onChange={(e) => updateDate(e.target.value)}
          aria-label={`${label} — date`}
        />
        <input
          id={`${id}-time`}
          className="time-input"
          type="time"
          step={900}
          value={time}
          required={required && !!date}
          disabled={disabled || !date}
          onChange={(e) => updateTime(e.target.value)}
          aria-label={`${label} — time`}
        />
      </div>
      {showPresets ? (
        <div className="dt-presets" role="group" aria-label="Quick time slots">
          {TIME_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`btn bs bsm dt-preset${time === p.value ? ' on' : ''}`}
              disabled={disabled || !date}
              onClick={() => updateTime(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
      {preview ? <div className="date-field-preview">{preview}</div> : null}
      {hint ? <p className="hint" style={{ textAlign: 'left' }}>{hint}</p> : null}
    </div>
  );
}
