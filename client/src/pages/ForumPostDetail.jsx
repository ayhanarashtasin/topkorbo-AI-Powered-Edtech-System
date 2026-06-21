import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import PostCard from '../components/forum/PostCard';
import CommentTree from '../components/forum/CommentTree';
import LoadingSkeleton from '../components/forum/LoadingSkeleton';
import EmptyState from '../components/forum/EmptyState';
import forumApi from '../services/forumApi';

export default function ForumPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setError(null);
    (async () => {
      try {
        const r = await forumApi.getPost(id);
        if (!cancelled) {
          setPost(r.data);
          setCommentCount(r.data.commentsCount || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

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
        onChange={(updated) => setPost(updated)}
        onDelete={() => navigate('/forum')}
      />

      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: 6 }}>Comments ({commentCount})</h3>
        <CommentTree postId={post._id} onCountChange={setCommentCount} />
      </div>
    </div>
  );
}