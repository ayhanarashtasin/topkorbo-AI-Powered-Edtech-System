import { Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import useAdminSession from '../hooks/useAdminSession';
import { getAuthToken } from '../../utils/authStorage';

export default function AdminRoute() {
  const { session, loading, error, isAdmin, refreshSession, logout } = useAdminSession();

  if (!getAuthToken()) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="admin-page-loader" aria-label="Loading admin access">
        <div className="admin-spinner" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (error && !session.name) {
    return (
      <div className="admin-page-error">
        <div className="admin-page-error__card">
          <h3>Unable to verify admin access</h3>
          <p>{error}</p>
          <button type="button" onClick={refreshSession}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <AdminLayout session={session} onLogout={logout} />;
}
