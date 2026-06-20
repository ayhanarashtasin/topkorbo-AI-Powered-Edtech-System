import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiApi, ApiError } from '../services/aiApi';

/**
 * useChat — per-chapter chat thread with the AI tutor.
 *
 * Mirrors the optimistic-update + rollback pattern used by `useHighlights`.
 * The hook re-fetches history automatically whenever `chapterId` or
 * `pageNumber` changes, so the sidebar always shows the right thread for
 * the page the student is currently looking at.
 *
 * @param {{ bookId: string, chapterId: string, pageNumber: number }} ctx
 */
export function useChat({ bookId, chapterId, pageNumber }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!chapterId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const data = await aiApi.history({ chapterId, pageNumber });
      setMessages(data?.messages || []);
    } catch (err) {
      // Don't toast on every page-flip — the empty state is informative enough.
      console.error('[useChat] history load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [chapterId, pageNumber]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = useCallback(
    async (question, pageText) => {
      const trimmed = (question || '').trim();
      if (!trimmed || sending) return null;
      if (!bookId || !chapterId || !pageNumber) {
        toast.error('Open a chapter page to chat with the tutor.');
        return null;
      }

      setSending(true);

      const tempId = `local-${Date.now()}`;
      const optimistic = {
        _id: tempId,
        role: 'user',
        content: trimmed,
        pageNumber,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const data = await aiApi.send({
          bookId,
          chapterId,
          pageNumber,
          question: trimmed,
          pageText
        });
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempId),
          data?.userMessage,
          data?.assistantMessage
        ].filter(Boolean));
        return data?.assistantMessage || null;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err?.message || 'Failed to reach AI tutor';
        toast.error(msg);
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        return null;
      } finally {
        setSending(false);
      }
    },
    [bookId, chapterId, pageNumber, sending]
  );

  const clear = useCallback(async () => {
    if (!chapterId) return;
    try {
      await aiApi.clear({ chapterId, pageNumber });
      setMessages([]);
      toast.success('Chat cleared');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err?.message || 'Failed to clear chat';
      toast.error(msg);
    }
  }, [chapterId, pageNumber]);

  return {
    messages,
    loading,
    sending,
    send,
    clear,
    refresh
  };
}