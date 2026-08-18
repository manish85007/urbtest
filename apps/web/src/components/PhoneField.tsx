import { useState, useEffect } from 'react';
import { COUNTRY_CODES, digitsOnly, formatE164, splitPhone } from '@urb-tectrack/shared';

interface PhoneFieldProps {
  label: string;
  value: string;
  onChange: (e164: string) => void;
  required?: boolean;
  id?: string;
  placeholder?: string;
}

/** Country-code select + 10-digit national number input. */
export function PhoneField({
  label,
  value,
  onChange,
  required,
  id,
  placeholder = '9845000000',
}: PhoneFieldProps) {
  const parsed = splitPhone(value);
  const inputId = id ?? `ph-${label.replace(/\s+/g, '-').toLowerCase()}`;

  // Keep a local draft so that partial typing (< 10 digits) doesn't corrupt
  // the controlled value via the E164 round-trip.
  const [draft, setDraft] = useState(parsed.national);
  const [cc, setCc] = useState(parsed.cc);

  // Sync draft when parent resets the value (e.g. vehicle edit loads existing)
  useEffect(() => {
    setDraft(parsed.national);
    setCc(parsed.cc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleNationalChange(raw: string) {
    const digits = digitsOnly(raw).slice(0, 10);
    setDraft(digits);
    onChange(digits ? formatE164(digits, cc) : '');
  }

  function handleCcChange(newCc: string) {
    setCc(newCc);
    onChange(draft ? formatE164(draft, newCc) : '');
  }

  return (
    <div className="fg">
      <label htmlFor={inputId}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="phone-in">
        <select
          aria-label="ISD country code"
          value={cc}
          onChange={(e) => handleCcChange(e.target.value)}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.cc} value={c.cc}>
              {c.label}
            </option>
          ))}
        </select>
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
          onChange={(e) => handleNationalChange(e.target.value)}
        />
      </div>
    </div>
  );
}
