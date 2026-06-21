import { useEffect, useRef, useState, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import PostCard from './PostCard';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import forumApi from '../../services/forumApi';

/**
 * InfiniteFeed — paginates a forumApi endpoint with cursor + auto-load on
 * intersection of a sentinel element. Re-fetches when `feedKey` changes.
 */
export default function InfiniteFeed({ feedKey, emptyTitle, emptyMessage, fetchPage }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset on feedKey change
  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setCursor(null);
    setDone(false);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const json = await fetchPage(null);
        if (cancelled) return;
        setItems(json.data || []);
        setCursor(json.nextCursor || null);
        setDone(!json.nextCursor);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchPage(cursor);
      setItems((prev) => [...prev, ...(json.data || [])]);
      setCursor(json.nextCursor || null);
      setDone(!json.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cursor, done, loading, fetchPage]);

  const { ref: sentinelRef, inView } = useInView({ rootMargin: '200px' });
  useEffect(() => {
    if (inView && !done && !loading) loadMore();
  }, [inView, done, loading, loadMore]);

  return (
    <div>
      {items.length === 0 && !loading && !error && (
        <EmptyState
          title={emptyTitle || 'Nothing here yet'}
          message={emptyMessage || 'Be the first to share something with the community.'}
        />
      )}
      {error && <div className="forum-error">{error}</div>}
      {items.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          onDelete={(id) => setItems((prev) => prev.filter((p) => p._id !== id))}
        />
      ))}
      {!done && (
        <div ref={sentinelRef} style={{ minHeight: 40 }}>
          {loading && <LoadingSkeleton count={2} />}
        </div>
      )}
    </div>
  );
}