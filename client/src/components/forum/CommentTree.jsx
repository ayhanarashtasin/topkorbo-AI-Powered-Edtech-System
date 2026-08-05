import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForum } from '../../context/ForumContext';
import CommentItem from './CommentItem';
import RichTextEditor from './RichTextEditor';
import MentionInput from './MentionInput';
import forumApi from '../../services/forumApi';

// CommentTree — manages the full comment thread for a post.
// Handles loading, tree construction from flat list, live socket updates,
// pagination via cursor, and top-level comment composition.
export default function CommentTree({ postId, onCountChange }) {
  const { user, createComment, subscribeComment } = useForum();
  const [allComments, setAllComments] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [topHtml, setTopHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const editorRef = useRef(null);
  // Deduplication set prevents duplicate comments from socket re-emissions.
  const commentIdsRef = useRef(new Set());

  // Adds a comment to state if not already present; returns true if actually added.
  const addComment = useCallback((comment) => {
    const id = String(comment._id);
    if (commentIdsRef.current.has(id)) return false;
    commentIdsRef.current.add(id);
    setAllComments((current) => [...current, comment]);
    onCountChange?.(1);
    return true;
  }, [onCountChange]);

  // Removes a comment from state; returns true if it was present.
  const removeComment = useCallback((commentId) => {
    const id = String(commentId);
    if (!commentIdsRef.current.has(id)) return false;
    commentIdsRef.current.delete(id);
    setAllComments((current) =>
      current.filter((comment) => String(comment._id) !== id)
    );
    onCountChange?.(-1);
    return true;
  }, [onCountChange]);

  // Fetch initial comment thread on mount or postId change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await forumApi.comments(postId);
        if (!cancelled) {
          const comments = response.data || [];
          commentIdsRef.current = new Set(comments.map((comment) => String(comment._id)));
          setAllComments(comments);
          setNextCursor(response.nextCursor || null);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // Subscribe to real-time comment events (new, edited, deleted) via socket.
  // Updates are applied incrementally without full re-fetch.
  useEffect(() => {
    const off = subscribeComment(postId, {
      onNew: (c) => {
        addComment(c);
      },
      onUpdate: (c) => {
        setAllComments((prev) => prev.map((x) => (x._id === c._id ? c : x)));
      },
      onDelete: ({ commentId }) => {
        removeComment(commentId);
      }
    });
    return () => off && off();
  }, [addComment, postId, removeComment, subscribeComment]);

  // Build a parent→children map from the flat comment array.
  // Comments whose parent is not in the dataset are treated as top-level.
  const tree = useMemo(() => {
    const byParent = new Map();
    const knownIds = new Set(allComments.map((comment) => String(comment._id)));
    for (const c of allComments) {
      const parentId = c.parent ? String(c.parent) : null;
      const key = parentId && knownIds.has(parentId) ? parentId : '__root__';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return byParent;
  }, [allComments]);

  // Recursively renders a comment node and its children from the tree map.
  function renderNode(c) {
    return (
      <CommentItem
        key={c._id}
        comment={c}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        postId={postId}
        onDelete={(id) => {
          removeComment(id);
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
                const created = await createComment(postId, {
                  contentHtml: html,
                  parentId: parent._id
                });
                addComment(created);
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

  // Submits a new top-level comment, resets the editor, and appends to state.
  async function submitTop() {
    const text = (editorRef.current?.getText() || '').trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const created = await createComment(postId, { contentHtml: topHtml });
      addComment(created);
      setTopHtml('');
      editorRef.current && editorRef.current.clear();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Fetches the next page of comments using cursor-based pagination.
  // Deduplicates against existing comments to avoid double-rendering.
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await forumApi.comments(postId, nextCursor);
      const incoming = response.data || [];
      for (const comment of incoming) {
        const id = String(comment._id);
        if (!commentIdsRef.current.has(id)) {
          commentIdsRef.current.add(id);
        }
      }
      setAllComments((current) => {
        const currentIds = new Set(current.map((comment) => String(comment._id)));
        return [
          ...current,
          ...incoming.filter((comment) => !currentIds.has(String(comment._id)))
        ];
      });
      setNextCursor(response.nextCursor || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMore(false);
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

      {error ? (
        <div className="forum-error" role="alert">{error}</div>
      ) : null}

      {loading ? (
        <p className="forum-muted" style={{ textAlign: 'center', padding: 16 }}>
          Loading comments…
        </p>
      ) : (tree.get('__root__') || []).length === 0 ? (
        <p className="forum-muted" style={{ textAlign: 'center', padding: 16 }}>
          Be the first to comment.
        </p>
      ) : (
        (tree.get('__root__') || []).map(renderNode)
      )}

      {nextCursor ? (
        <button
          type="button"
          className="forum-load-more"
          disabled={loadingMore}
          onClick={loadMore}
        >
          {loadingMore ? 'Loading…' : 'Load more comments'}
        </button>
      ) : null}
    </div>
  );
}

// Inline reply composer that appears nested under a specific comment.
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
