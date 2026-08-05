/**
 * InfiniteFeed - Cursor-based paginated feed with infinite scroll.
 *
 * Uses react-intersection-observer to detect when the user scrolls near the
 * bottom and automatically loads the next page. Supports real-time updates
 * via WebSocket subscriptions so new posts, reactions, and deletions appear
 * instantly without a manual refresh.
 *
 * The `feedKey` prop forces a full remount when the feed context changes
 * (e.g., switching between "All" and "My Posts"), resetting pagination state.
 */
import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import PostCard from './PostCard';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import { useForum } from '../../context/ForumContext';

function PaginatedFeed({
  emptyTitle,
  emptyMessage,
  fetchPage,
  acceptNewPost,
  removeWhenUnbookmarked = false
}) {
  const { subscribePost } = useForum();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load the first page on mount. The `cancelled` flag prevents state updates
   * if the component unmounts before the request completes (strict-mode safe).
   * Duplicate IDs are filtered so hot-reloaded or pre-populated posts aren't
   * rendered twice.
   */
  useEffect(() => {
    let cancelled = false;
    async function loadFirstPage() {
      try {
        const response = await fetchPage(null);
        if (cancelled) return;
        setItems((currentItems) => {
          const incoming = response.data || [];
          const incomingIds = new Set(incoming.map((item) => String(item._id)));
          return [...currentItems.filter((item) => !incomingIds.has(String(item._id))), ...incoming];
        });
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

  /**
   * Real-time updates: when a WebSocket event arrives, update the local list
   * immediately so the UI stays in sync with other users' actions without
   * waiting for the next poll or page reload.
   */
  useEffect(() => subscribePost({
    onNew: (post) => {
      if (!acceptNewPost?.(post)) return;
      setItems((currentItems) => [
        post,
        ...currentItems.filter((item) => String(item._id) !== String(post._id))
      ]);
    },
    onUpdate: (post) => {
      setItems((currentItems) => currentItems.map((item) =>
        String(item._id) === String(post._id)
          ? {
            ...item,
            ...post,
            userReaction: item.userReaction,
            bookmarked: item.bookmarked
          }
          : item
      ));
    },
    onDelete: ({ postId }) => {
      setItems((currentItems) => currentItems.filter((item) =>
        String(item._id) !== String(postId)
      ));
    },
    onStats: ({ postId, ...stats }) => {
      setItems((currentItems) => currentItems.map((item) =>
        String(item._id) === String(postId) ? { ...item, ...stats } : item
      ));
    }
  }), [acceptNewPost, subscribePost]);

  /**
   * Fetch the next page using the cursor from the previous response.
   * Deduplicates items by ID to avoid rendering the same post twice if the
   * server returns overlapping results (e.g., after a new post is created).
   */
  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPage(cursor);
      setItems((currentItems) => {
        const existing = new Set(currentItems.map((item) => String(item._id)));
        return [
          ...currentItems,
          ...(response.data || []).filter((item) => !existing.has(String(item._id)))
        ];
      });
      setCursor(response.nextCursor || null);
      setDone(!response.nextCursor);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [cursor, done, fetchPage, loading]);

  /**
   * Intersection observer sentinel: triggers `loadMore` when the sentinel div
   * enters the viewport. The 200px rootMargin starts loading before the user
   * reaches the actual bottom, making the scroll feel seamless.
   */
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
          onBookmarkChange={(bookmarked) => {
            setItems((currentItems) => removeWhenUnbookmarked && !bookmarked
              ? currentItems.filter((item) => item._id !== post._id)
              : currentItems.map((item) => item._id === post._id
                ? { ...item, bookmarked }
                : item));
          }}
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

export default function InfiniteFeed({
  feedKey,
  emptyTitle,
  emptyMessage,
  fetchPage,
  acceptNewPost,
  removeWhenUnbookmarked
}) {
  return (
    <PaginatedFeed
      key={feedKey}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      fetchPage={fetchPage}
      acceptNewPost={acceptNewPost}
      removeWhenUnbookmarked={removeWhenUnbookmarked}
    />
  );
}
