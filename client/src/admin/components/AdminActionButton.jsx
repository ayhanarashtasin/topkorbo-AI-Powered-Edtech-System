export default function AdminActionButton({
  children,
  tone = 'default',
  variant = 'solid',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`admin-action-button admin-action-button--${tone} admin-action-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
