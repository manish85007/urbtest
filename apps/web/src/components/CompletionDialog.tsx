import { Modal } from './Modal';

export function CompletionDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const text = message.trim().startsWith('✓') ? message : `✓ ${message}`;
  return (
    <Modal title="Confirmed" onClose={onClose} okLabel="OK" okOnly onOk={onClose}>
      <p style={{ margin: 0, fontSize: '.92rem', lineHeight: 1.55 }}>{text}</p>
    </Modal>
  );
}
