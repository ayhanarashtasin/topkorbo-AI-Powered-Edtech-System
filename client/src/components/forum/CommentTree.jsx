import { useEffect, useMemo, useRef, useState } from 'react';
import { useForum } from '../../context/ForumContext';
import CommentItem from './CommentItem';
import RichTextEditor from './RichTextEditor';
import MentionInput from './MentionInput';
import forumApi from '../../services/forumApi';

// CommentTree — loads a post's comments, groups them by parent into a
// tree, and renders them recursively. Also subscribes to live
// `comment:new / update / delete` socket events for real-time updates.
export default function CommentTree({ postId, onCountChange }) {
  const { user, createComment, subscribeComment } = useForum();
  const [allComments, setAllComments] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [topHtml, setTopHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef(null);
  const mentionRef = useRef(null);

  // Initial load of the comment thread.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await forumApi.comments(postId);
        if (!cancelled) setAllComments(r.data || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // Live updates from the socket: new / edited / deleted comments.
  useEffect(() => {
    const off = subscribeComment(postId, {
      onNew: (c) => {
        setAllComments((prev) => (prev.find((x) => x._id === c._id) ? prev : [...prev, c]));
      },
      onUpdate: (c) => {
        setAllComments((prev) => prev.map((x) => (x._id === c._id ? c : x)));
      },
      onDelete: ({ commentId }) => {
        setAllComments((prev) => prev.filter((x) => x._id !== commentId));
      }
    });
    return () => off && off();
  }, [postId, subscribeComment]);

  useEffect(() => {
    onCountChange && onCountChange(allComments.length);
  }, [allComments.length, onCountChange]);

  // Group comments by their parent ID so we can render them as a tree.
  // `__root__` is the synthetic bucket for top-level comments.
  const tree = useMemo(() => {
    const byParent = new Map();
    for (const c of allComments) {
      const key = c.parent ? String(c.parent) : '__root__';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return byParent;
  }, [allComments]);

  function renderNode(c) {
    return (
      <CommentItem
        key={c._id}
        comment={c}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        postId={postId}
        onDelete={(id) => {
          setAllComments((prev) => prev.filter((x) => x._id !== id));
        }}
        onUpdate={(updated) => {
          setAllComments((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
        }}
        onReply={(parent) => (
          <ReplyBox
            parent={parent}
            onCancel={() => setReplyingTo(null)}
            onSubmit={async (html) => {
              try {
                await createComment(postId, { contentHtml: html, parentId: parent._id });
                setReplyingTo(null);
              } catch (e) {
                alert(e.message);
              }
            }}
          />
        )}
      >
        {(tree.get(String(c._id)) || []).map(renderNode)}
      </CommentItem>
    );
  }

  async function submitTop() {
    const text = (editorRef.current?.getText() || '').trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await createComment(postId, { contentHtml: topHtml });
      setTopHtml('');
      editorRef.current && editorRef.current.clear();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forum-comments">
      <div className="forum-composer" style={{ padding: 16, marginBottom: 16 }}>
        <RichTextEditor
          ref={editorRef}
          placeholder={user ? 'Write a comment…' : 'Sign in to comment'}
          onChange={(html) => setTopHtml(html)}
        />
        <MentionInput containerRef={editorRef} onSelect={() => {}} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            type="button"
            className="forum-composer__submit"
            disabled={submitting || !topHtml.trim()}
            onClick={submitTop}
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </div>

      {(tree.get('__root__') || []).length === 0 ? (
        <p className="forum-muted" style={{ textAlign: 'center', padding: 16 }}>
          Be the first to comment.
        </p>
      ) : (
        (tree.get('__root__') || []).map(renderNode)
      )}
    </div>
  );
}

function ReplyBox({ parent, onSubmit, onCancel }) {
  const [html, setHtml] = useState('');
  const editorRef = useRef(null);

  return (
    <div>
      <RichTextEditor
        ref={editorRef}
        placeholder={`Reply to ${parent.author?.name || 'this comment'}…`}
        minHeight={80}
        onChange={setHtml}
      />
      <MentionInput containerRef={editorRef} onSelect={() => {}} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="forum-btn" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="forum-btn forum-btn--primary"
          disabled={!html.trim()}
          onClick={() => onSubmit(html)}
        >
          Reply
        </button>
      </div>
    </div>
  );
}