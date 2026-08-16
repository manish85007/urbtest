import { COUNTRY_CODES, digitsOnly, formatE164, splitPhone } from '@urb-tectrack/shared';

interface PhoneFieldProps {
  label: string;
  value: string;
  onChange: (e164: string) => void;
  required?: boolean;
  id?: string;
  placeholder?: string;
}

/** Country-code select + frozen 10-digit national number. Label stays on the 10-digit input for e2e. */
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

  function emit(cc: string, national: string) {
    const n = digitsOnly(national).slice(0, 10);
    onChange(n ? formatE164(n, cc) : '');
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
          value={parsed.cc}
          onChange={(e) => emit(e.target.value, parsed.national)}
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
          value={parsed.national}
          required={required}
          onChange={(e) => emit(parsed.cc, digitsOnly(e.target.value).slice(0, 10))}
        />
      </div>
    </div>
  );
}
