import React, { startTransition, useCallback } from 'react'; // eslint-disable-line no-unused-vars -- Vitest uses the classic JSX runtime.
import { Link, useSearchParams } from 'react-router-dom';
import {
  HiArrowRight,
  HiLightningBolt,
  HiOutlineChatAlt2,
  HiPlus
} from 'react-icons/hi';
import InfiniteFeed from '../components/forum/InfiniteFeed';
import CategoryPicker from '../components/forum/CategoryPicker';
import TrendingTicker from '../components/forum/TrendingTicker';
import forumApi from '../services/forumApi';

const FEEDS = [
  { id: 'latest', label: 'Latest', description: 'Fresh questions & ideas' },
  { id: 'trending', label: 'Trending', description: 'What students are reading' },
  { id: 'following', label: 'Following', description: 'People you learn with' },
  { id: 'discussed', label: 'Most Discussed', description: 'Active conversations' }
];

const FEED_IDS = new Set(FEEDS.map((feed) => feed.id));

function CommunityIntro() {
  return (
    <section className="forum-community-intro" aria-labelledby="forum-page-title">
      <div className="forum-community-intro__icon" aria-hidden="true">
        <HiOutlineChatAlt2 />
      </div>

      <div className="forum-community-intro__copy">
        <p className="forum-section-heading__eyebrow">TopKorbo Community</p>
        <h1 id="forum-page-title">Learn Better, Together</h1>
        <p>
          Ask questions, compare solutions, and share the study advice that
          helped you move forward.
        </p>
      </div>

      <div className="forum-community-intro__actions">
        <Link className="forum-community-intro__primary" to="/forum/compose">
          <HiPlus aria-hidden="true" />
          Start a Discussion
        </Link>
        <a className="forum-community-intro__secondary" href="#forum-topic-title">
          Browse Topics
          <HiArrowRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function FeedNavigation({ activeFeed, onChange }) {
  return (
    <div className="forum-feed-tabs" role="tablist" aria-label="Discussion feed">
      {FEEDS.map((feed) => (
        <button
          key={feed.id}
          type="button"
          role="tab"
          aria-selected={activeFeed === feed.id}
          aria-controls="forum-feed-results"
          className={`forum-feed-tab ${activeFeed === feed.id ? 'forum-feed-tab--active' : ''}`}
          onClick={() => onChange(feed.id)}
        >
          <span>{feed.label}</span>
          <small>{feed.description}</small>
        </button>
      ))}
    </div>
  );
}

function ForumRailCard({ eyebrow, title, children }) {
  return (
    <section className="forum-rail-card">
      <p className="forum-rail-card__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ForumRail() {
  return (
    <aside className="forum-home__rail" aria-label="Community highlights">
      <ForumRailCard eyebrow="Trending Now" title="Top Conversations">
        <TrendingTicker />
      </ForumRailCard>

      <ForumRailCard eyebrow="Before You Post" title="Make Answers Easier">
        <ol className="forum-answer-guide">
          <li><span>01</span><div><strong>Name the exact step</strong><p>Show where your reasoning starts to break.</p></div></li>
          <li><span>02</span><div><strong>Add what you tried</strong><p>A little context leads to a much better answer.</p></div></li>
          <li><span>03</span><div><strong>Close the loop</strong><p>Mark the explanation that helped you move forward.</p></div></li>
        </ol>
      </ForumRailCard>

      <div className="forum-kindness-note">
        <HiOutlineChatAlt2 aria-hidden="true" />
        <p><strong>Help others learn.</strong> Share the missing step, not just the final answer.</p>
      </div>
    </aside>
  );
}

export default function Forum() {
  const [searchParams, setSearchParams] = useSearchParams();
  const feedParam = searchParams.get('feed');
  const feed = FEED_IDS.has(feedParam) ? feedParam : 'latest';
  const category = searchParams.get('category') || 'All';
  const activeFeed = FEEDS.find((item) => item.id === feed) || FEEDS[0];

  const updateFilter = useCallback((key, value, defaultValue) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === defaultValue) nextParams.delete(key);
    else nextParams.set(key, value);
    startTransition(() => setSearchParams(nextParams, { replace: true }));
  }, [searchParams, setSearchParams]);

  const fetchPage = useCallback(
    (cursor) => forumApi.feed({ feed, category, cursor, limit: 15 }),
    [category, feed]
  );
  const acceptNewPost = useCallback((post) => (
    feed === 'latest' && (category === 'All' || post.category === category)
  ), [category, feed]);

  return (
    <div className="forum-home">
      <CommunityIntro />
      <div className="forum-home__grid">
        <div className="forum-home__feed">
          <section className="forum-topic-desk" aria-labelledby="forum-topic-title">
            <div className="forum-section-heading">
              <div>
                <p className="forum-section-heading__eyebrow">Explore Community</p>
                <h2 id="forum-topic-title">Browse by Topic</h2>
              </div>
              <HiLightningBolt aria-hidden="true" />
            </div>
            <CategoryPicker
              active={category}
              onChange={(nextCategory) => updateFilter('category', nextCategory, 'All')}
            />
          </section>

          <section id="community-board" className="forum-feed-board" aria-labelledby="community-board-title">
            <header className="forum-feed-board__header">
              <div>
                <p className="forum-section-heading__eyebrow">Community Board</p>
                <h2 id="community-board-title">{activeFeed.label} Discussions</h2>
              </div>
              <span className="forum-feed-board__category">{category === 'All' ? 'All topics' : category}</span>
            </header>

            <FeedNavigation
              activeFeed={feed}
              onChange={(nextFeed) => updateFilter('feed', nextFeed, 'latest')}
            />

            <div id="forum-feed-results" role="tabpanel" aria-live="polite">
              <InfiniteFeed
                feedKey={`${feed}|${category}`}
                fetchPage={fetchPage}
                acceptNewPost={acceptNewPost}
                emptyTitle="No discussions here yet"
                emptyMessage={
                  feed === 'following'
                    ? 'Follow students and tutors whose explanations help you learn.'
                    : category !== 'All'
                      ? `No one has started a ${category} discussion yet.`
                      : 'Start the first useful conversation for the community.'
                }
              />
            </div>
          </section>
        </div>
        <ForumRail />
      </div>
    </div>
  );
}
