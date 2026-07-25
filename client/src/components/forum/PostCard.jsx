import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiDotsHorizontal, HiOutlineHeart, HiHeart, HiOutlineBookmark, HiBookmark, HiFlag, HiPencilAlt, HiTrash } from 'react-icons/hi';
import { FaRegCommentDots } from 'react-icons/fa';
import { UserAvatarLink } from './UserAvatar';
import { useForum } from '../../context/ForumContext';
import forumApi from '../../services/forumApi';
import ReportModal from './ReportModal';
import { sanitizeHtml } from '../../utils/safeHtml';

function formatRelative(date) {
  if (!date) return '';
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(date).toLocaleDateString();
}

/**
 * PostCard — single post in the feed.
 *
 * Optimistically updates reactions and the bookmark toggle, then subscribes
 * to live `reaction:update` socket events to reconcile with the server.
 */
export default function PostCard({ post, onDelete, detail = false }) {
  const navigate = useNavigate();
  const { user, toggleReaction, subscribeReaction, toggleBookmark } = useForum();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = user && String(user._id) === String(post.author?._id);
  const userId = user?._id ? String(user._id) : null;

  // Local state for the reaction counts / which one the current user picked
  // and the bookmark flag — all updated optimistically for snappy UI.
  const [counts, setCounts] = useState(post.reactionsCount || { like: 0, love: 0 });
  const [myReaction, setMyReaction] = useState(post.userReaction || null);
  const [bookmarked, setBookmarked] = useState(!!post.bookmarked);

  // Subscribe to live reaction updates for this post.
  useEffect(() => {
    if (!post?._id) return;
    const off = subscribeReaction('post', post._id, (payload) => {
      setCounts(payload.counts);
      if (payload.userId && userId && String(payload.userId) === userId) {
        setMyReaction(payload.userReaction);
      }
    });
    return () => off && off();
  }, [post?._id, subscribeReaction, userId]);

  async function react(type) {
    if (busy) return;
    setBusy(true);
    setCounts((c) => {
      const next = { ...c };
      if (myReaction === type) {
        next[type] = Math.max(0, (next[type] || 0) - 1);
      } else {
        if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] || 0) - 1);
        next[type] = (next[type] || 0) + 1;
      }
      return next;
    });
    setMyReaction((cur) => (cur === type ? null : type));
    try {
      const result = await toggleReaction({
        targetType: 'post',
        target: post._id,
        type
      });
      setCounts(result.counts);
      setMyReaction(result.userReaction);
    } catch {
      setCounts(post.reactionsCount || { like: 0, love: 0 });
      setMyReaction(post.userReaction || null);
    } finally {
      setBusy(false);
    }
  }

  async function bookmark() {
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const r = await toggleBookmark(post._id);
      setBookmarked(!!r.bookmarked);
    } catch {
      setBookmarked(prev);
    }
  }

  return (
    <article className="forum-post">
      <div className="forum-post__header">
        <UserAvatarLink user={post.author} />
        <div className="forum-post__author-block">
          <span className="forum-post__author-name">
            {post.author?.name || 'Unknown'}
            {post.author?.forumRole === 'tutor' || post.author?.forumRole === 'teacher' || post.author?.role === 'tutor' ? (
              <span className="forum-role-badge forum-role-badge--tutor" title="Tutor">
                Tutor
              </span>
            ) : null}
            {post.author?.forumRole === 'admin' ? (
              <span className="forum-role-badge forum-role-badge--admin">
                Admin
              </span>
            ) : null}
            {post.author?.reputation > 0 && (
              <span className="forum-rep" title="Reputation">★ {post.author.reputation}</span>
            )}
          </span>
          <span className="forum-post__author-meta">
            <span>{post.author?.username ? `@${post.author.username}` : ''}</span>
            <span>· {formatRelative(post.createdAt)} {post.isEdited ? '(edited)' : ''}</span>
          </span>
        </div>
        <span className="forum-post__category">{post.type === 'question' ? 'Question' : post.category}</span>
      </div>

      {post.title ? (
        <h2 className="forum-post__title">
          {detail ? post.title : <Link to={`/forum/post/${post._id}`}>{post.title}</Link>}
        </h2>
      ) : null}

      {/* `contentHtml` is sanitized server-side; we sanitize again client-side
          (defense in depth) so a stale/compromised payload still can't run JS. */}
      <div
        className="forum-post__body"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.contentHtml || '') }}
      />

      {!detail && !post.title ? (
        <Link className="forum-post__open-link" to={`/forum/post/${post._id}`}>
          Open Discussion
        </Link>
      ) : null}

      {post.images && post.images.length > 0 && (
        <div className="forum-post__media">
          {post.images.map((img, i) => (
            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <img
                src={img.url}
                alt={post.title ? `Attachment for ${post.title}` : 'Discussion attachment'}
                width="720"
                height="420"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </a>
          ))}
        </div>
      )}

      {post.tags && post.tags.length > 0 && (
        <div className="forum-post__tags">
          {post.tags.map((t) => (
            <span key={t} className="forum-tag">#{t}</span>
          ))}
        </div>
      )}

      <div className="forum-post__actions">
        <button
          type="button"
          className={`forum-action-btn ${myReaction === 'like' ? 'forum-action-btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); react('like'); }}
          disabled={busy}
          aria-pressed={myReaction === 'like'}
        >
          <HiOutlineHeart size={18} aria-hidden="true" />
          <span className="forum-action-btn__count">{counts.like || 0}</span>
          <span>Like</span>
        </button>
        <button
          type="button"
          className={`forum-action-btn forum-action-btn--love ${myReaction === 'love' ? 'forum-action-btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); react('love'); }}
          disabled={busy}
          aria-pressed={myReaction === 'love'}
        >
          <HiHeart size={18} aria-hidden="true" />
          <span className="forum-action-btn__count">{counts.love || 0}</span>
          <span>Love</span>
        </button>
        <Link
          className="forum-action-btn"
          to={`/forum/post/${post._id}`}
        >
          <FaRegCommentDots size={16} aria-hidden="true" />
          <span className="forum-action-btn__count">{post.commentsCount || 0}</span>
          <span>Comments</span>
        </Link>
        <button
          type="button"
          className={`forum-action-btn ${bookmarked ? 'forum-action-btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); bookmark(); }}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? 'Remove from saved discussions' : 'Save discussion'}
        >
          {bookmarked ? <HiBookmark size={18} aria-hidden="true" /> : <HiOutlineBookmark size={18} aria-hidden="true" />}
          <span>{bookmarked ? 'Saved' : 'Save'}</span>
        </button>

        <div className="forum-post__menu">
          <button
            type="button"
            className="forum-action-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More discussion actions"
          >
            <HiDotsHorizontal size={18} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="forum-menu-list" role="menu" onMouseLeave={() => setMenuOpen(false)}>
              {isOwner && (
                <>
                  <button
                    type="button"
                    className="forum-menu-item"
                    onClick={() => { setMenuOpen(false); navigate(`/forum/compose?edit=${post._id}`); }}
                  >
                    <HiPencilAlt size={16} aria-hidden="true" /> Edit Post
                  </button>
                  <button
                    type="button"
                    className="forum-menu-item forum-menu-item--danger"
                    onClick={async () => {
                      setMenuOpen(false);
                      if (!window.confirm('Delete this post? This cannot be undone.')) return;
                      try {
                        await forumApi.deletePost(post._id);
                        onDelete && onDelete(post._id);
                      } catch (e) {
                        alert(e.message);
                      }
                    }}
                  >
                    <HiTrash size={16} aria-hidden="true" /> Delete Post
                  </button>
                </>
              )}
              {!isOwner && (
                <button
                  type="button"
                  className="forum-menu-item"
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                >
                  <HiFlag size={16} aria-hidden="true" /> Report Post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ReportModal
        targetType="post"
        target={post._id}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </article>
  );
}
