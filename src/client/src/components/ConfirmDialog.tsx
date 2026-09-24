interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  testIdPrefix?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  testIdPrefix = "dialog",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-crt-000/80 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="panel crt w-[340px] max-w-full p-6 text-center">
        <h2
          data-testid={`${testIdPrefix}-title`}
          className="mb-3 font-press text-[13px] text-gold-500 [text-shadow:2px_2px_0_#5C4A0E]"
        >
          {title}
        </h2>
        <p data-testid={`${testIdPrefix}-message`} className="mb-5 text-sm text-arc-100">
          {message}
        </p>
        <div className="flex justify-center gap-3">
          <button
            data-testid={`${testIdPrefix}-cancel`}
            onClick={onCancel}
            className="btn btn-ghost px-4 py-3 text-[9px]"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            data-testid={`${testIdPrefix}-confirm`}
            onClick={onConfirm}
            className={`btn ${danger ? "btn-danger" : "btn-primary"} px-4 py-3 text-[9px]`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}