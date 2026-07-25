import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import PostCard from './PostCard';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';

function PaginatedFeed({ emptyTitle, emptyMessage, fetchPage }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadFirstPage() {
      try {
        const response = await fetchPage(null);
        if (cancelled) return;
        setItems(response.data || []);
        setCursor(response.nextCursor || null);
        setDone(!response.nextCursor);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFirstPage();
    return () => { cancelled = true; };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPage(cursor);
      setItems((currentItems) => [...currentItems, ...(response.data || [])]);
      setCursor(response.nextCursor || null);
      setDone(!response.nextCursor);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [cursor, done, fetchPage, loading]);

  const { ref: sentinelRef } = useInView({
    rootMargin: '200px',
    onChange: (inView) => {
      if (inView) loadMore();
    }
  });

  return (
    <div>
      {items.length === 0 && !loading && !error ? (
        <EmptyState
          title={emptyTitle || 'Nothing here yet'}
          message={emptyMessage || 'Start the first useful conversation for the community.'}
        />
      ) : null}
      {error ? (
        <div className="forum-error" role="alert">
          <span>{error}. Check your connection, then try again.</span>
          <button type="button" onClick={loadMore}>Try Again</button>
        </div>
      ) : null}
      {items.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          onDelete={(id) => setItems((currentItems) => currentItems.filter((item) => item._id !== id))}
        />
      ))}
      {!done ? (
        <div ref={sentinelRef} className="forum-feed-sentinel">
          {loading ? (
            <LoadingSkeleton count={2} />
          ) : (
            <button type="button" className="forum-load-more" onClick={loadMore}>
              Load More Discussions
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function InfiniteFeed({ feedKey, emptyTitle, emptyMessage, fetchPage }) {
  return (
    <PaginatedFeed
      key={feedKey}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      fetchPage={fetchPage}
    />
  );
}
