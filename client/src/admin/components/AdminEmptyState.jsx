import AdminActionButton from './AdminActionButton';

export default function AdminEmptyState({ title, description, actionLabel, onAction, compact = false }) {
  return (
    <div className={`admin-empty-state ${compact ? 'admin-empty-state--compact' : ''}`}>
      <div className="admin-empty-state__icon">+</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <AdminActionButton variant="ghost" onClick={onAction}>
          {actionLabel}
        </AdminActionButton>
      ) : null}
    </div>
  );
}
