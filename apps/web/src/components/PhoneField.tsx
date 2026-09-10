import { useState, useEffect } from 'react';
import { digitsOnly, national10 } from '@urb-tectrack/shared';

interface PhoneFieldProps {
  label: string;
  value: string;
  /** Emits a 10-digit national number (or '' while incomplete). */
  onChange: (national10: string) => void;
  required?: boolean;
  id?: string;
  placeholder?: string;
}

/** 10-digit mobile input — no country-code prefix in the UI. */
export function PhoneField({
  label,
  value,
  onChange,
  required,
  id,
  placeholder = '9845000000',
}: PhoneFieldProps) {
  const inputId = id ?? `ph-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const [draft, setDraft] = useState(national10(value));

  useEffect(() => {
    setDraft(national10(value));
  }, [value]);

  function handleChange(raw: string) {
    const digits = digitsOnly(raw).slice(0, 10);
    setDraft(digits);
    onChange(digits.length === 10 ? digits : digits);
  }

  return (
    <div className="fg">
      <label htmlFor={inputId}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        pattern="[0-9]{10}"
        placeholder={placeholder}
        value={draft}
        required={required}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
