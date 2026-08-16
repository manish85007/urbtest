import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={wide ? { maxWidth: 860 } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="m-hd">
          <div className="m-ttl" id="modal-title">
            {title}
          </div>
          <button type="button" className="m-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="m-bd">{children}</div>
        {footer ? <div className="m-ft">{footer}</div> : null}
      </div>
    </div>
  );
}
