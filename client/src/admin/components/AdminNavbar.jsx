import { HiBars3BottomLeft, HiBell, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import AdminActionButton from './AdminActionButton';
import AdminBadge from './AdminBadge';

export default function AdminNavbar({ pageTitle, session, onOpenSidebar, onLogout }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar__left">
        <button
          type="button"
          className="admin-topbar__menu"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          <HiBars3BottomLeft />
        </button>
        <div>
          <p className="admin-topbar__eyebrow">Administration</p>
          <h2>{pageTitle}</h2>
        </div>
      </div>

      <div className="admin-topbar__right">
        <button type="button" className="admin-icon-button" aria-label="Notifications">
          <HiBell />
        </button>

        <div className="admin-profile-chip">
          <div className="admin-avatar">{session.name?.charAt(0)?.toUpperCase() || 'A'}</div>
          <div>
            <strong>{session.name || 'Admin'}</strong>
            <p>{session.email || 'admin session'}</p>
          </div>
        </div>

        <AdminBadge tone="info" size="sm">{session.forumRole || 'admin'}</AdminBadge>

        <AdminActionButton type="button" tone="neutral" variant="ghost" className="admin-logout-button" onClick={onLogout}>
          <HiOutlineArrowRightOnRectangle />
          <span>Logout</span>
        </AdminActionButton>
      </div>
    </header>
  );
}
