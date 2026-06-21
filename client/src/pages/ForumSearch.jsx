import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HiSearch } from 'react-icons/hi';
import forumApi from '../services/forumApi';
import useDebounce from '../hooks/useDebounce';
import EmptyState from '../components/forum/EmptyState';
import UserAvatar from '../components/forum/UserAvatar';

export default function ForumSearch() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get('q') || '';
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState('all');
  const [data, setData] = useState({ posts: [], users: [], categories: [] });
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(q, 350);

  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);

  useEffect(() => {
    if (!debounced.trim()) {
      setData({ posts: [], users: [], categories: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    forumApi
      .search(debounced, tab)
      .then((r) => {
        if (!cancelled) setData(r.data || { posts: [], users: [], categories: [] });
      })
      .catch(() => {
        if (!cancelled) setData({ posts: [], users: [], categories: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debounced, tab]);

  function onSubmit(e) {
    e.preventDefault();
    setParams(q ? { q } : {});
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <form className="forum-search" onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
        <HiSearch className="forum-search__icon" size={18} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search posts, people, or categories"
          aria-label="Search"
          autoFocus
        />
      </form>

      <div className="forum-search-tabs" role="tablist" style={{ marginTop: 18 }}>
        {['all', 'post', 'user', 'category'].map((t) => (
          <button
            key={t}
            type="button"
            className={`forum-search-tab ${tab === t ? 'forum-search-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'post' ? 'Posts' : t === 'user' ? 'People' : 'Categories'}
          </button>
        ))}
      </div>

      {loading && <p className="forum-muted">Searching…</p>}

      {!loading && !q && (
        <EmptyState title="Type to search" message="Find posts, people, and categories from across the community." />
      )}

      {!loading && q && data.posts.length === 0 && data.users.length === 0 && data.categories.length === 0 && (
        <EmptyState title="No results" message={`Nothing matches "${q}". Try a different keyword.`} />
      )}

      {data.posts.length > 0 && (tab === 'all' || tab === 'post') && (
        <section>
          <h3 style={{ marginBottom: 10 }}>Posts</h3>
          {data.posts.map((p) => (
            <div
              key={p._id}
              className="forum-search-result"
              onClick={() => navigate(`/forum/post/${p._id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <UserAvatar user={p.author} size="sm" />
                <strong>{p.author?.name}</strong>
                <span className="forum-muted" style={{ fontSize: '0.78rem' }}>· {p.category}</span>
              </div>
              {p.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title}</div>}
              <div className="forum-muted" style={{ fontSize: '0.88rem' }}>
                {(p.contentText || '').slice(0, 200)}…
              </div>
            </div>
          ))}
        </section>
      )}

      {data.users.length > 0 && (tab === 'all' || tab === 'user') && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 10 }}>People</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {data.users.map((u) => (
              <div
                key={u._id}
                className="forum-search-result"
                onClick={() => navigate(`/forum/u/${u._id}`)}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <UserAvatar user={u} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.name}</div>
                    <div className="forum-muted" style={{ fontSize: '0.78rem' }}>
                      {u.username ? `@${u.username}` : u.email}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.categories.length > 0 && (tab === 'all' || tab === 'category') && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 10 }}>Categories</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.categories.map((c) => (
              <button
                key={c.name}
                type="button"
                className="forum-category-chip"
                onClick={() => {
                  setQ(c.name);
                  navigate(`/forum?q=${encodeURIComponent(c.name)}`);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}