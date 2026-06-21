export default function EmptyState({ title, message, action, icon }) {
  return (
    <div className="forum-empty">
      {icon && <div style={{ fontSize: '2rem', marginBottom: 8 }}>{icon}</div>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}