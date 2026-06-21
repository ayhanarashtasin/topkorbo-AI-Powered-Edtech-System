import { useEffect, useRef, useState } from 'react';
import { HiOutlineHeart, HiHeart, HiOutlineReply, HiPencilAlt, HiTrash, HiFlag } from 'react-icons/hi';
import { useForum } from '../../context/ForumContext';
import UserAvatar from './UserAvatar';
import ReportModal from './ReportModal';
import forumApi from '../../services/forumApi';

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
 * CommentItem — a single comment with reply box, edit, delete, reactions.
 * Recursive: children are rendered inside `children` slot.
 */
export default function CommentItem({
  comment,
  onReply,
  replyingTo,
  setReplyingTo,
  children,
  onDelete,
  onUpdate,
  postId
}) {
  const { user, toggleReaction, subscribeReaction } = useForum();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState(comment.contentHtml || '');
  const [counts, setCounts] = useState(comment.reactionsCount || { like: 0, love: 0 });
  const [myReaction, setMyReaction] = useState(null);
  const [busy, setBusy] = useState(false);

  const isOwner = user && String(user._id) === String(comment.author?._id);

  useEffect(() => {
    setCounts(comment.reactionsCount || { like: 0, love: 0 });
  }, [comment.reactionsCount]);

  useEffect(() => {
    if (!comment?._id) return;
    const off = subscribeReaction('comment', comment._id, (payload) => {
      setCounts(payload.counts);
      if (payload.userId && user && payload.userId === String(user._id)) {
        setMyReaction(payload.userReaction);
      }
    });
    return () => off && off();
  }, [comment?._id, subscribeReaction, user]);

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
      await toggleReaction({ targetType: 'comment', target: comment._id, type });
    } catch (e) {
      setCounts(comment.reactionsCount || { like: 0, love: 0 });
      setMyReaction(null);
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
      <UserAvatar user={comment.author} size="sm" to />
      <div className="forum-comment__body">
        <div className="forum-comment__head">
          <span className="forum-comment__author">{comment.author?.name || 'Unknown'}</span>
          {comment.author?.username && <span>@{comment.author.username}</span>}
          <span>· {formatRelative(comment.createdAt)}</span>
          {comment.isEdited && <span>(edited)</span>}
          {comment.author?.forumRole === 'admin' && <span className="forum-profile-header__role" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>Admin</span>}
        </div>

        {editing ? (
          <div>
            <textarea
              className="forum-composer__textarea"
              style={{ minHeight: 80, width: '100%', border: '1px solid rgba(140,90,60,0.18)', borderRadius: 8, padding: 8, font: 'inherit' }}
              value={editHtml}
              onChange={(e) => setEditHtml(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" className="forum-btn forum-btn--primary" onClick={saveEdit} disabled={busy}>
                Save
              </button>
              <button type="button" className="forum-btn" onClick={() => { setEditing(false); setEditHtml(comment.contentHtml); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="forum-comment__text"
            dangerouslySetInnerHTML={{ __html: comment.contentHtml || '' }}
          />
        )}

        <div className="forum-comment__actions">
          <button type="button" className={`forum-comment__action ${myReaction === 'like' ? 'forum-action-btn--active' : ''}`} onClick={() => react('like')}>
            <HiOutlineHeart size={13} /> {counts.like || 0}
          </button>
          <button type="button" className={`forum-comment__action forum-action-btn--love ${myReaction === 'love' ? 'forum-action-btn--active' : ''}`} onClick={() => react('love')}>
            <HiHeart size={13} /> {counts.love || 0}
          </button>
          <button type="button" className="forum-comment__action" onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}>
            <HiOutlineReply size={13} /> Reply
          </button>
          {isOwner && (
            <>
              <button type="button" className="forum-comment__action" onClick={() => setEditing(true)}>
                <HiPencilAlt size={13} /> Edit
              </button>
              <button type="button" className="forum-comment__action" onClick={deleteThis}>
                <HiTrash size={13} /> Delete
              </button>
            </>
          )}
          {!isOwner && (
            <button type="button" className="forum-comment__action" onClick={() => setReportOpen(true)}>
              <HiFlag size={13} /> Report
            </button>
          )}
        </div>

        {replyingTo === comment._id && (
          <div className="forum-comment__reply-box">
            {onReply && onReply(comment, (html) => {
              // Caller closes the box on success
            })}
          </div>
        )}

        {children && <div className="forum-comment__children">{children}</div>}
      </div>

      <ReportModal targetType="comment" target={comment._id} open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}