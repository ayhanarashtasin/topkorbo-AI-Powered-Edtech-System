import { NavLink } from 'react-router-dom';
import AdminBadge from './AdminBadge';

export default function AdminPageHeader({
  eyebrow = 'Admin Console',
  title,
  description,
  badge,
  actions = null,
  tabs = []
}) {
  return (
    <section className="admin-page-header">
      <div className="admin-page-header__main">
        <div>
          <p className="admin-page-header__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className="admin-page-header__description">{description}</p> : null}
        </div>
        <div className="admin-page-header__actions">
          {badge ? <AdminBadge tone={badge.tone || 'neutral'}>{badge.label}</AdminBadge> : null}
          {actions}
        </div>
      </div>

      {tabs.length ? (
        <div className="admin-tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `admin-tab ${isActive ? 'admin-tab--active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </section>
  );
}
