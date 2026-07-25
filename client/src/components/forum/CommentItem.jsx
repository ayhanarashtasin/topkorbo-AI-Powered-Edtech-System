import { useEffect, useState } from 'react';
import { HiOutlineHeart, HiHeart, HiOutlineReply, HiPencilAlt, HiTrash, HiFlag } from 'react-icons/hi';
import { useForum } from '../../context/ForumContext';
import { UserAvatarLink } from './UserAvatar';
import ReportModal from './ReportModal';
import forumApi from '../../services/forumApi';
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

// CommentItem — single comment with reply, edit, delete, and reactions.
// Recursive: descendant comments are passed in via the `children` slot.
export default function CommentItem({
  comment,
  onReply,
  replyingTo,
  setReplyingTo,
  children,
  onDelete,
  onUpdate
}) {
  const { user, toggleReaction, subscribeReaction } = useForum();
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState(comment.contentHtml || '');
  const [counts, setCounts] = useState(comment.reactionsCount || { like: 0, love: 0 });
  const [myReaction, setMyReaction] = useState(comment.userReaction || null);
  const [busy, setBusy] = useState(false);

  const isOwner = user && String(user._id) === String(comment.author?._id);
  const userId = user?._id ? String(user._id) : null;

  useEffect(() => {
    if (!comment?._id) return;
    const off = subscribeReaction('comment', comment._id, (payload) => {
      setCounts(payload.counts);
      if (payload.userId && userId && String(payload.userId) === userId) {
        setMyReaction(payload.userReaction);
      }
    });
    return () => off && off();
  }, [comment?._id, subscribeReaction, userId]);

  async function react(type) {
    if (busy) return;
    setBusy(true);
    setCounts((c) => {
      const next = { ...c };
      if (myReaction === type) next[type] = Math.max(0, next[type] - 1);
      else {
        if (myReaction) next[myReaction] = Math.max(0, next[myReaction] - 1);
        next[type] = (next[type] || 0) + 1;
      }
      return next;
    });
    setMyReaction((cur) => (cur === type ? null : type));
    try {
      const result = await toggleReaction({
        targetType: 'comment',
        target: comment._id,
        type
      });
      setCounts(result.counts);
      setMyReaction(result.userReaction);
    } catch {
      setCounts(comment.reactionsCount || { like: 0, love: 0 });
      setMyReaction(comment.userReaction || null);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editHtml.trim()) return;
    setBusy(true);
    try {
      const j = await forumApi.updateComment(comment._id, { contentHtml: editHtml });
      onUpdate && onUpdate(j.data);
      setEditing(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteThis() {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await forumApi.deleteComment(comment._id);
      onDelete && onDelete(comment._id);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="forum-comment" data-depth={comment.depth || 0}>
      <UserAvatarLink user={comment.author} size="sm" />
      <div className="forum-comment__body">
        <div className="forum-comment__head">
          <span className="forum-comment__author">{comment.author?.name || 'Unknown'}</span>
          {comment.author?.username && <span>@{comment.author.username}</span>}
          <span>· {formatRelative(comment.createdAt)}</span>
          {comment.isEdited && <span>(edited)</span>}
          {comment.author?.forumRole === 'admin' && <span className="forum-role-badge forum-role-badge--admin">Admin</span>}
        </div>

        {editing ? (
          <div>
            <textarea
              className="forum-composer__textarea"
              style={{ minHeight: 80, width: '100%', border: '1px solid rgba(140,90,60,0.18)', borderRadius: 8, padding: 8, font: 'inherit' }}
              value={editHtml}
              onChange={(e) => setEditHtml(e.target.value)}
              name="edited-comment"
              aria-label="Edit comment"
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="forum-btn forum-btn--primary" onClick={saveEdit} disabled={busy}>
                Save Edit
              </button>
              <button type="button" className="forum-btn" onClick={() => { setEditing(false); setEditHtml(comment.contentHtml); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="forum-comment__text"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.contentHtml || '') }}
          />
        )}

        <div className="forum-comment__actions">
          <button type="button" className={`forum-comment__action ${myReaction === 'like' ? 'forum-action-btn--active' : ''}`} onClick={() => react('like')} aria-pressed={myReaction === 'like'} disabled={busy}>
            <HiOutlineHeart size={13} aria-hidden="true" /> {counts.like || 0}
          </button>
          <button type="button" className={`forum-comment__action forum-action-btn--love ${myReaction === 'love' ? 'forum-action-btn--active' : ''}`} onClick={() => react('love')} aria-pressed={myReaction === 'love'} disabled={busy}>
            <HiHeart size={13} aria-hidden="true" /> {counts.love || 0}
          </button>
          <button type="button" className="forum-comment__action" onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}>
            <HiOutlineReply size={13} aria-hidden="true" /> Reply
          </button>
          {isOwner && (
            <>
              <button type="button" className="forum-comment__action" onClick={() => setEditing(true)}>
                <HiPencilAlt size={13} aria-hidden="true" /> Edit
              </button>
              <button type="button" className="forum-comment__action" onClick={deleteThis}>
                <HiTrash size={13} aria-hidden="true" /> Delete
              </button>
            </>
          )}
          {!isOwner && (
            <button type="button" className="forum-comment__action" onClick={() => setReportOpen(true)}>
              <HiFlag size={13} aria-hidden="true" /> Report
            </button>
          )}
        </div>

        {replyingTo === comment._id && (
          <div className="forum-comment__reply-box">
            {onReply && onReply(comment, () => {})}
          </div>
        )}

        {children && <div className="forum-comment__children">{children}</div>}
      </div>

      <ReportModal targetType="comment" target={comment._id} open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
