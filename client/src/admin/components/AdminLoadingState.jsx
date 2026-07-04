export default function AdminLoadingState({ label = 'Loading admin data...' }) {
  return (
    <div className="admin-page-loader" aria-label={label}>
      <div className="admin-spinner" />
      <p>{label}</p>
    </div>
  );
}
