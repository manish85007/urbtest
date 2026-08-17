import type { FormEvent, ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Kit openM primary action — Cancel is shown beside it unless `okOnly`. */
  okLabel?: string;
  /** When set, the OK button submits this <form id>. */
  form?: string;
  onOk?: () => void | Promise<unknown>;
  busy?: boolean;
  /** Hide Cancel — used for post-save confirmation. */
  okOnly?: boolean;
  /** Render the title as h1 (new-request e2e heading). */
  heading?: boolean;
}

/** Same popup chrome as the kit `openM(title, body, okLabel)` helper. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  okLabel,
  form,
  onOk,
  busy,
  okOnly,
  heading,
}: ModalProps) {
  const TitleTag = heading ? 'h1' : 'div';

  async function handleOk(e: FormEvent) {
    e.preventDefault();
    await onOk?.();
  }

  const actions =
    footer ??
    (okLabel ? (
      <>
        {okOnly ? null : (
          <button type="button" className="btn bs" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        )}
        <button
          type={form ? 'submit' : 'button'}
          form={form}
          className="btn bp"
          disabled={busy}
          onClick={form ? undefined : (e) => void handleOk(e)}
        >
          {okLabel}
        </button>
      </>
    ) : null);

  return (
    <div className="modal-bg" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{ maxWidth: wide ? 980 : 760 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="m-hd">
          <TitleTag className="m-ttl" id="modal-title">
            {title}
          </TitleTag>
          <button type="button" className="m-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="m-bd">{children}</div>
        {actions ? <div className="m-ft">{actions}</div> : null}
      </div>
    </div>
  );
}
