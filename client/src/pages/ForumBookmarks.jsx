import { useEffect, useState } from 'react';
import PostCard from '../components/forum/PostCard';
import LoadingSkeleton from '../components/forum/LoadingSkeleton';
import EmptyState from '../components/forum/EmptyState';
import forumApi from '../services/forumApi';

export default function ForumBookmarks() {
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await forumApi.myBookmarks();
        if (!cancelled) setPosts(r.data || []);
      } catch (e) {
        if (!cancelled) setPosts([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (posts === null) return <LoadingSkeleton count={2} />;

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No saved posts yet"
        message="Click the Save button on any post to add it here for later."
      />
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 14 }}>Your bookmarks</h2>
      {posts.map((p) => (
        <PostCard
          key={p._id}
          post={{ ...p, bookmarked: true }}
          onDelete={() => setPosts((prev) => prev.filter((x) => x._id !== p._id))}
        />
      ))}
    </div>
  );
}