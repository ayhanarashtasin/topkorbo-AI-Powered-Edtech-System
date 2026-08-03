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
