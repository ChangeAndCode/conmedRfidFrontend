type ConfirmActionModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'danger';
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'default',
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <section className='adminModalOverlay' onClick={isSubmitting ? undefined : onCancel}>
      <div className='adminModalCard adminConfirmCard' onClick={(event) => event.stopPropagation()}>
        <div className='adminModalTitleBlock'>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>

        <div className='adminConfirmActions'>
          <button
            className='buttonSelector'
            type='button'
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            className={`buttonSelector ${confirmVariant === 'danger' ? 'adminDangerButton' : ''}`}
            type='button'
            onClick={() => void onConfirm()}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ConfirmActionModal;
