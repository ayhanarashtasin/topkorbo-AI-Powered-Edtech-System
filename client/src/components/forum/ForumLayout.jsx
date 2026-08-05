/**
 * ForumLayout - Persistent chrome for the community section.
 *
 * Provides the top navigation bar (branding, global search, quick-action
 * links) and renders child routes via <Outlet/>. The sidebar is rendered
 * alongside the main content area so navigation remains accessible while
 * browsing different forum views.
 *
 * Auth guard: redirects unauthenticated users to the landing page on mount
 * by checking for the presence of a JWT in localStorage.
 */
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HiBookmark, HiPlus, HiSearch, HiUserCircle } from 'react-icons/hi';
import Sidebar from '../layout/Sidebar';
import NotificationBell from './NotificationBell';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../hooks/useLanguage';
import '../../styles/forum.css';

export default function ForumLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useForum();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  /** Auth guard: bounce unauthenticated visitors back to the home page. */
  useEffect(() => {
    const token = localStorage.getItem('topkorbo_token');
    if (!token) window.location.href = '/';
  }, []);

  /** Submit the search form and navigate to the search results page. */
  function onSearch(event) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;
    navigate(`/forum/search?q=${encodeURIComponent(nextQuery)}`);
  }

  /**
   * Derive the active sidebar tab from the current URL so the sidebar can
   * visually highlight the matching link without extra state management.
   */
  const activeTab = (() => {
    if (location.pathname.startsWith('/forum/compose')) return 'compose';
    if (location.pathname.startsWith('/forum/search')) return 'search';
    if (location.pathname.startsWith('/forum/bookmarks')) return 'bookmarks';
    if (location.pathname.startsWith('/forum/u/')) return 'profile';
    return 'forum';
  })();

  /** Build a localized search placeholder, stripping any trailing punctuation. */
  const localizedPlaceholder = t('forum.search_placeholder')
    || 'Search discussions, people, or topics';
  const searchPlaceholder = `${localizedPlaceholder.replace(/[.\u2026]+$/, '')}\u2026`;

  return (
    <div className="forum-shell">
      <a className="forum-skip-link" href="#forum-main-content">Skip to Community</a>
      <Sidebar activeTab={activeTab} user={user} />

      <div className="forum-main">
        {/* Top bar: brand identity, global search, and quick-action buttons. */}
        <header className="forum-header">
          <Link className="forum-header__identity" to="/forum" aria-label="TopKorbo Community home">
            <span className="forum-header__mark" aria-hidden="true">TK</span>
            <span>
              <strong>Community</strong>
              <small>Learn together</small>
            </span>
          </Link>

          {/* Global search: submits on Enter, navigates to /forum/search with the query. */}
          <form className="forum-search" onSubmit={onSearch} role="search">
            <label className="forum-visually-hidden" htmlFor="forum-global-search">
              Search the community
            </label>
            <HiSearch className="forum-search__icon" size={18} aria-hidden="true" />
            <input
              id="forum-global-search"
              name="forum-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
            />
            <kbd aria-hidden="true">Enter</kbd>
          </form>

          {/* Quick-action links: notifications, bookmarks, profile, and new post. */}
          <nav className="forum-header__actions" aria-label="Community shortcuts">
            <NotificationBell />
            <Link
              className="forum-icon-btn"
              to="/forum/bookmarks"
              aria-label={t('forum.bookmarks') || 'Saved discussions'}
              title={t('forum.bookmarks') || 'Saved discussions'}
            >
              <HiBookmark size={19} aria-hidden="true" />
            </Link>
            {user ? (
              <Link
                className="forum-icon-btn"
                to={`/forum/u/${user._id}`}
                aria-label={t('forum.profile') || 'Your community profile'}
                title={t('forum.profile') || 'Your community profile'}
              >
                <HiUserCircle size={21} aria-hidden="true" />
              </Link>
            ) : null}
            <Link className="forum-compose-btn" to="/forum/compose">
              <HiPlus size={18} aria-hidden="true" />
              <span>{t('forum.compose') || 'New Post'}</span>
            </Link>
          </nav>
        </header>

        {/* Main content area: child routes render here via React Router. */}
        <main id="forum-main-content" className="forum-content" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
