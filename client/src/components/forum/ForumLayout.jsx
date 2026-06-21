import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { HiSearch, HiPlus, HiBookmark, HiUserCircle } from 'react-icons/hi';
import Sidebar from '../layout/Sidebar';
import NotificationBell from './NotificationBell';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../hooks/useLanguage';
import '../../styles/forum.css';

/**
 * ForumLayout — chrome that wraps every /forum/* page.
 * Reuses the existing Sidebar for navigation and adds a forum header
 * (search, compose, notifications, profile shortcut).
 */
export default function ForumLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useForum();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  // Simple auth guard — bounce to landing if no token at all
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) {
      window.location.href = '/';
    }
  }, []);

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/forum/search?q=${encodeURIComponent(q)}`);
  }

  const activeTab = (() => {
    if (location.pathname.startsWith('/forum/compose')) return 'compose';
    if (location.pathname.startsWith('/forum/search')) return 'search';
    if (location.pathname.startsWith('/forum/bookmarks')) return 'bookmarks';
    if (location.pathname.startsWith('/forum/u/')) return 'profile';
    return 'forum';
  })();

  return (
    <div className="forum-shell">
      <Sidebar activeTab={activeTab} user={user} />

      <div className="forum-main">
        <header className="forum-header">
          <div className="forum-header__left">
            <h1 className="forum-header__title">Community</h1>
            <p className="forum-header__subtitle">
              {t('forum.subtitle') || 'Connect, share and learn with fellow TopKorbo students.'}
            </p>
          </div>

          <form className="forum-search" onSubmit={onSearch} role="search">
            <HiSearch className="forum-search__icon" size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('forum.search_placeholder') || 'Search posts, people, or categories'}
              aria-label="Search"
            />
          </form>

          <div className="forum-header__actions">
            <NotificationBell />
            <button
              className="forum-icon-btn"
              type="button"
              title={t('forum.bookmarks') || 'Bookmarks'}
              onClick={() => navigate('/forum/bookmarks')}
            >
              <HiBookmark size={20} />
            </button>
            <button
              className="forum-icon-btn"
              type="button"
              title={t('forum.profile') || 'My profile'}
              onClick={() => user && navigate(`/forum/u/${user._id}`)}
            >
              <HiUserCircle size={20} />
            </button>
            <button
              className="forum-compose-btn"
              type="button"
              onClick={() => navigate('/forum/compose')}
            >
              <HiPlus size={18} />
              <span>{t('forum.compose') || 'New post'}</span>
            </button>
          </div>
        </header>

        <div className="forum-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}