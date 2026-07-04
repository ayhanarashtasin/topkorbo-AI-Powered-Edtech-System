export default function AdminStatCard({ label, value, hint, icon = null, tone = 'neutral' }) {
  return (
    <article className={`admin-stat-card admin-stat-card--${tone}`}>
      <div className="admin-stat-card__top">
        <p className="admin-stat-card__label">{label}</p>
        {icon ? <div className="admin-stat-card__icon">{icon}</div> : null}
      </div>
      <h3 className="admin-stat-card__value">{value}</h3>
      <p className="admin-stat-card__hint">{hint}</p>
    </article>
  );
}
