import { HiChevronLeft } from 'react-icons/hi2';
import { NavLink } from 'react-router-dom';
import { adminNavigation } from '../routes/adminNavigation';

export default function AdminSidebar({ session, sidebarOpen, onClose }) {
  return (
    <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`}>
      <div className="admin-sidebar__brand">
        <div>
          <p>TopKorbo Console</p>
          <h1>Admin Panel</h1>
        </div>
        <button
          type="button"
          className="admin-sidebar__close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <HiChevronLeft />
        </button>
      </div>

      <nav className="admin-sidebar__nav">
        {adminNavigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
            }
            onClick={onClose}
          >
            <span className="admin-sidebar__icon"><item.icon /></span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__user">
          <div className="admin-avatar">{session.name?.charAt(0)?.toUpperCase() || 'A'}</div>
          <div>
            <strong>{session.name || 'Admin'}</strong>
            <p>{session.email || 'Signed in'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
