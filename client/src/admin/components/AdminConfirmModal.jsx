import { useEffect, useState } from 'react';

export default function AdminConfirmModal({
  open,
  title,
  description,
  requireReason = false,
  reasonLabel = 'Reason',
  confirmLabel = 'Confirm',
  onClose,
  onConfirm
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>

        {requireReason ? (
          <label className="admin-field">
            <span>{reasonLabel}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Add a short explanation"
            />
          </label>
        ) : null}

        <div className="admin-modal__actions">
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={requireReason && !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
