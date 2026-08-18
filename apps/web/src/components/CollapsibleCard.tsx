import { useState, type CSSProperties, type ReactNode } from 'react';

interface CollapsibleCardProps {
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export function CollapsibleCard({
  title,
  badge,
  actions,
  summary,
  defaultOpen = true,
  children,
  className = 'card',
  style,
  id,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className} style={style} id={id}>
      <div className="card-hd">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          {open ? '−' : '+'}
        </button>
        <div className="card-ttl">{title}</div>
        {badge}
        <div className="spacer" />
        {actions}
      </div>
      {open ? children : summary ? <div className="collapse-summary">{summary}</div> : null}
    </div>
  );
}
