import { useCallback } from 'react';
import InfiniteFeed from '../components/forum/InfiniteFeed';
import forumApi from '../services/forumApi';

export default function ForumBookmarks() {
  const fetchPage = useCallback(
    (cursor) => forumApi.myBookmarks({ cursor, limit: 20 }),
    []
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 14 }}>Your bookmarks</h2>
      <InfiniteFeed
        feedKey="bookmarks"
        fetchPage={fetchPage}
        emptyTitle="No saved posts yet"
        emptyMessage="Click the Save button on any post to add it here for later."
        removeWhenUnbookmarked
      />
    </div>
  );
}
