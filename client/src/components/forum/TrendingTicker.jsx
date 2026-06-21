import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import forumApi from '../../services/forumApi';

export default function TrendingTicker() {
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    forumApi.feed({ feed: 'trending', limit: 5 }).then((r) => {
      if (!cancelled) setPosts(r.data || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!posts.length) {
    return <p className="forum-muted" style={{ fontSize: '0.86rem' }}>No trending posts yet — check back soon.</p>;
  }

  return (
    <div className="forum-trending">
      {posts.map((p, idx) => (
        <div
          key={p._id}
          className="forum-trending__item"
          onClick={() => navigate(`/forum/post/${p._id}`)}
        >
          <span className="forum-trending__rank">{idx + 1}</span>
          <div>
            <div className="forum-trending__title">
              {p.title || (p.contentText || '').slice(0, 80)}
            </div>
            <div className="forum-trending__meta">
              {p.commentsCount || 0} comments · {(p.reactionsCount?.like || 0) + (p.reactionsCount?.love || 0)} reactions
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}