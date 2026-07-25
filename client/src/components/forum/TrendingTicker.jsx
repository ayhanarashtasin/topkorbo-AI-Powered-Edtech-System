import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import forumApi from '../../services/forumApi';

const numberFormatter = new Intl.NumberFormat();

export default function TrendingTicker() {
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    forumApi.feed({ feed: 'trending', limit: 5 })
      .then((response) => {
        if (!cancelled) setPosts(response.data || []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => { cancelled = true; };
  }, []);

  if (posts === null) {
    return <p className="forum-trending__status" role="status">{'Finding active conversations\u2026'}</p>;
  }

  if (!posts.length) {
    return <p className="forum-trending__status">No trending discussions yet. Check back soon.</p>;
  }

  return (
    <ol className="forum-trending">
      {posts.map((post, index) => {
        const reactions = (post.reactionsCount?.like || 0) + (post.reactionsCount?.love || 0);
        const title = post.title || (post.contentText || '').slice(0, 80) || 'Open discussion';

        return (
          <li key={post._id} className="forum-trending__item">
            <Link to={`/forum/post/${post._id}`}>
              <span className="forum-trending__rank" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="forum-trending__content">
                <strong className="forum-trending__title">{title}</strong>
                <span className="forum-trending__meta">
                  {numberFormatter.format(post.commentsCount || 0)} comments
                  <span aria-hidden="true"> / </span>
                  {numberFormatter.format(reactions)} reactions
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
