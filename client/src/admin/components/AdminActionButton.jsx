export default function AdminActionButton({
  children,
  tone = 'default',
  variant = 'solid',
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`admin-action-button admin-action-button--${tone} admin-action-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
