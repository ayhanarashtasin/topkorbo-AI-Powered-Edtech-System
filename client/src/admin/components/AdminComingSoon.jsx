import AdminBadge from './AdminBadge';

export default function AdminComingSoon({ title, description, bullets = [] }) {
  return (
    <article className="admin-coming-soon">
      <div className="admin-coming-soon__header">
        <div>
          <p className="admin-topbar__eyebrow">Coming in next phase</p>
          <h3>{title}</h3>
        </div>
        <AdminBadge tone="planned">Planned</AdminBadge>
      </div>
      <p>{description}</p>
      {bullets.length ? (
        <ul className="admin-list admin-list--compact">
          {bullets.map((item) => (
            <li key={item}>
              <div>
                <strong>{item}</strong>
                <span>Scaffolded safely inside the admin console.</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
