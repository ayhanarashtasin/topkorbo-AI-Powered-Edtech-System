export default function AdminBadge({ children, tone = 'neutral', size = 'md' }) {
  return <span className={`admin-badge admin-badge--${tone} admin-badge--${size}`}>{children}</span>;
}
