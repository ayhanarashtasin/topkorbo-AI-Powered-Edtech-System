import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import PostCard from '../components/forum/PostCard';
import CommentTree from '../components/forum/CommentTree';
import LoadingSkeleton from '../components/forum/LoadingSkeleton';
import EmptyState from '../components/forum/EmptyState';
import forumApi from '../services/forumApi';
import { useForum } from '../context/ForumContext';

export default function ForumPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscribePost } = useForum();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loadedId, setLoadedId] = useState(null);
  const changeCommentCount = useCallback((delta) => {
    setCommentCount((current) => Math.max(0, current + delta));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await forumApi.getPost(id);
        if (!cancelled) {
          setPost(r.data);
          setError(null);
          setCommentCount(r.data.commentsCount || 0);
          setLoadedId(id);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoadedId(id);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => subscribePost({
    onUpdate: (updated) => {
      if (String(updated._id) !== String(id)) return;
      setPost((current) => current ? {
        ...current,
        ...updated,
        userReaction: current.userReaction,
        bookmarked: current.bookmarked
      } : updated);
      setCommentCount(updated.commentsCount || 0);
    },
    onDelete: ({ postId }) => {
      if (String(postId) === String(id)) {
        setPost(null);
        setError('This post is no longer available.');
      }
    },
    onStats: ({ postId, commentsCount, ...stats }) => {
      if (String(postId) !== String(id)) return;
      setPost((current) => current ? { ...current, ...stats, commentsCount } : current);
      if (commentsCount !== undefined) setCommentCount(commentsCount);
    }
  }), [id, subscribePost]);

  if (loadedId !== id) return <LoadingSkeleton count={1} />;
  if (error) {
    return (
      <EmptyState
        title="Could not load this post"
        message={error}
        action={<button className="forum-btn forum-btn--primary" onClick={() => navigate('/forum')}>Back to feed</button>}
      />
    );
  }
  if (!post) return <LoadingSkeleton count={1} />;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <button
        type="button"
        className="forum-btn"
        style={{ marginBottom: 14, padding: '6px 14px' }}
        onClick={() => navigate(-1)}
      >
        <HiArrowLeft size={16} style={{ marginRight: 4 }} /> Back
      </button>

      <PostCard
        post={post}
        detail
        onBookmarkChange={(bookmarked) => setPost((current) => ({ ...current, bookmarked }))}
        onDelete={() => navigate('/forum')}
      />

      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 6 }}>Comments ({commentCount})</h3>
        <CommentTree
          key={post._id}
          postId={post._id}
          onCountChange={changeCommentCount}
        />
      </div>
    </div>
  );
}
