import { useCallback, useEffect, useState } from 'react';
import httpClient from '../../services/httpClient';
import { clearAuthStorage, getAuthToken, syncUserStorage } from '../../utils/authStorage';

const INITIAL_SESSION = {
  name: localStorage.getItem('topkorbo_name') || '',
  avatar: localStorage.getItem('topkorbo_avatar') || '',
  email: localStorage.getItem('topkorbo_email') || '',
  role: localStorage.getItem('topkorbo_role') || 'student',
  forumRole: localStorage.getItem('topkorbo_forum_role') || 'user'
};

const GUEST_SESSION = {
  name: '',
  avatar: '',
  email: '',
  role: 'student',
  forumRole: 'user'
};

export default function useAdminSession() {
  const [session, setSession] = useState(INITIAL_SESSION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setSession(GUEST_SESSION);
      setError('Authentication required');
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError('');

    try {
      const user = await httpClient.request('/auth/me');
      syncUserStorage(user);
      setSession({
        name: user.name || '',
        avatar: user.avatar || '',
        email: user.email || '',
        role: user.role || 'student',
        forumRole: user.forumRole || 'user'
      });
      return user;
    } catch (err) {
      if (err.status === 401) {
        clearAuthStorage();
        setSession(GUEST_SESSION);
      }
      if (err.status !== 401) {
        setSession((prev) => ({ ...prev, forumRole: 'user' }));
      }
      setError(err.message || 'Failed to load admin session');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(() => {
    clearAuthStorage();
    window.location.href = '/';
  }, []);

  return {
    session,
    loading,
    error,
    isAdmin: session.forumRole === 'admin',
    refreshSession,
    logout
  };
}
