import { useState } from 'react';
import InfiniteFeed from '../components/forum/InfiniteFeed';
import CategoryPicker from '../components/forum/CategoryPicker';
import TrendingTicker from '../components/forum/TrendingTicker';
import forumApi from '../services/forumApi';

const FEEDS = [
  { id: 'latest', label: 'Latest' },
  { id: 'trending', label: 'Trending' },
  { id: 'following', label: 'Following' },
  { id: 'discussed', label: 'Most Discussed' }
];

export default function Forum() {
  const [feed, setFeed] = useState('latest');
  const [category, setCategory] = useState('All');

  const feedKey = `${feed}|${category}`;

  function fetchPage(cursor) {
    return forumApi.feed({ feed, category, cursor, limit: 15 });
  }

  return (
    <div className="forum-layout-2col">
      <aside className="forum-side-panel">
        <div className="forum-side-card">
          <h3>Trending Now</h3>
          <TrendingTicker />
        </div>
        <div className="forum-side-card">
          <h3>Tips</h3>
          <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.6 }}>
            <li>Use <strong>@username</strong> to mention someone.</li>
          </ul>
        </div>
      </aside>

      <main>
        <CategoryPicker active={category} onChange={setCategory} />
        <div className="forum-feed-tabs" role="tablist">
          {FEEDS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={feed === f.id}
              className={`forum-feed-tab ${feed === f.id ? 'forum-feed-tab--active' : ''}`}
              onClick={() => setFeed(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <InfiniteFeed
          feedKey={feedKey}
          fetchPage={fetchPage}
          emptyTitle="No posts here yet"
          emptyMessage={
            feed === 'following'
              ? 'Follow some students and tutors to see their posts here.'
              : category !== 'All'
                ? `Nothing has been posted in ${category} yet.`
                : 'Be the first to start a discussion.'
          }
        />
      </main>

      <aside className="forum-side-panel" />
    </div>
  );
}