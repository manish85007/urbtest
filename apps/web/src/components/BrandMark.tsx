const MARK_PATHS = (
  <>
    <path d="M35.7 8.8 A22 22 0 0 1 50.7 37.5 L44.7 40.3 L43.2 34.8 A14 14 0 0 0 33.6 16.5 Z" />
    <path
      d="M35.7 8.8 A22 22 0 0 1 50.7 37.5 L44.7 40.3 L43.2 34.8 A14 14 0 0 0 33.6 16.5 Z"
      transform="rotate(120 30 30)"
    />
    <path
      d="M35.7 8.8 A22 22 0 0 1 50.7 37.5 L44.7 40.3 L43.2 34.8 A14 14 0 0 0 33.6 16.5 Z"
      transform="rotate(240 30 30)"
    />
  </>
);

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Urbeno" className={className}>
      <rect width="60" height="60" rx="12" fill="#3B6D11" />
      <g transform="translate(5.4 5.4) scale(0.82)" fill="#fff">
        {MARK_PATHS}
      </g>
    </svg>
  );
}

export function LogoPrimary() {
  return (
    <svg
      viewBox="0 0 252 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Urbeno — Recycling Heroes"
      style={{ maxWidth: 210, height: 'auto', display: 'block', margin: '0 auto' }}
    >
      <g transform="translate(2 2)" fill="#3B6D11">
        <g transform="scale(1)">{MARK_PATHS}</g>
      </g>
      <text
        x="76"
        y="40"
        fontFamily="'DM Serif Display', Georgia, serif"
        fontSize="34"
        fill="#3B6D11"
        letterSpacing="-0.3"
      >
        Urbeno
      </text>
      <line x1="74" y1="47" x2="244" y2="47" stroke="#C0DD97" strokeWidth="1" />
      <text
        x="74"
        y="58"
        fontFamily="'DM Sans', Arial, sans-serif"
        fontSize="9"
        fill="#5a6657"
        letterSpacing="1.8"
        fontWeight="600"
      >
        RECYCLING HEROES
      </text>
    </svg>
  );
}
