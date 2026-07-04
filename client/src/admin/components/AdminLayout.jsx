import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminNavbar from './AdminNavbar';
import AdminSidebar from './AdminSidebar';
import { getAdminPageTitle } from '../routes/adminNavigation';
import '../styles/admin.css';

export default function AdminLayout({ session, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageTitle = getAdminPageTitle(location.pathname);

  return (
    <div className="admin-shell">
      <AdminSidebar
        session={session}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`admin-sidebar__backdrop ${sidebarOpen ? 'admin-sidebar__backdrop--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="admin-main">
        <AdminNavbar
          pageTitle={pageTitle}
          session={session}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={onLogout}
        />

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
