import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiApi, ApiError } from '../services/aiApi';

/**
 * useChat - book-scoped chat thread with the AI tutor.
 *
 * The hook re-fetches history automatically whenever the active context
 * changes so the sidebar always reflects the selected page, topic, chapter,
 * or full-book scope.
 *
 * @param {{ bookId: string, chapterId?: string, topicId?: string, nodeId?: string, pageNumber?: number, scope?: 'page'|'topic'|'chapter'|'book'|'node', selectedTopicTitle?: string, selectedChapterTitle?: string, selectedNodeTitle?: string }} ctx
 */
export function useChat({
  bookId,
  chapterId,
  topicId,
  nodeId,
  pageNumber,
  scope = 'page',
  selectedTopicTitle,
  selectedChapterTitle,
  selectedNodeTitle
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const buildContextLabel = useCallback((mode = scope, page = pageNumber) => {
    if (mode === 'page' && Number.isFinite(Number(page)) && Number(page) >= 1) {
      return 'Current Page';
    }
    if (mode === 'chapter') return 'Chapter';
    if (mode === 'topic') return 'Selected Topic';
    if (mode === 'node') return 'Selected Node';
    return 'Full Book';
  }, [pageNumber, scope]);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const data = await aiApi.bookHistory({ bookId, chapterId, topicId, nodeId, pageNumber, scope });
      setMessages(data?.messages || []);
    } catch (err) {
      console.error('[useChat] history load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId, topicId, nodeId, pageNumber, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const send = useCallback(
    async (question, pageText, extra = {}) => {
      const trimmed = (question || '').trim();
      if (!trimmed || sending) return null;
      if (!bookId) {
        toast.error('Open a book to chat with the tutor.');
        return null;
      }

      const effectiveScope = extra.scopeOverride || scope;
      const effectivePageNumber = effectiveScope === 'page' ? pageNumber : null;
      const effectiveChapterId = effectiveScope === 'book' ? '' : chapterId;
      const effectiveTopicId = effectiveScope === 'book' ? '' : topicId;
      const effectiveNodeId = effectiveScope === 'book' ? '' : nodeId;
      const focusText = extra.focusText || '';
      const focusLabel = extra.focusLabel || '';
      const focusPageNumber = Number.isInteger(Number(extra.focusPageNumber)) && Number(extra.focusPageNumber) >= 1
        ? Number(extra.focusPageNumber)
        : null;

      setSending(true);

      const tempId = `local-${Date.now()}`;
      const optimistic = {
        _id: tempId,
        role: 'user',
        content: trimmed,
        pageNumber: effectivePageNumber,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const data = await aiApi.sendBook({
          bookId,
          chapterId: effectiveChapterId,
          topicId: effectiveTopicId,
          nodeId: effectiveNodeId,
          pageNumber: effectivePageNumber,
          scope: effectiveScope,
          question: trimmed,
          pageText,
          requestedAction: extra.requestedAction,
          focusText,
          focusLabel,
          focusPageNumber,
          selectedTopicTitle,
          selectedChapterTitle,
          selectedNodeTitle
        });
        const assistantMessage = data?.assistantMessage
          ? {
              ...data.assistantMessage,
              action: data?.action || extra.requestedAction || 'answer',
              contextLabel: data?.contextLabel || buildContextLabel(effectiveScope, effectivePageNumber),
              sources: data?.sources || data?.assistantMessage?.sources || []
            }
          : null;
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempId),
          data?.userMessage,
          assistantMessage
        ].filter(Boolean));
        return assistantMessage || null;
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
    [bookId, chapterId, topicId, nodeId, pageNumber, scope, selectedTopicTitle, selectedChapterTitle, selectedNodeTitle, sending, buildContextLabel]
  );

  const clear = useCallback(async () => {
    if (!bookId) return;
    try {
      const clearPageNumber = scope === 'page' ? pageNumber : null;
      const clearChapterId = scope === 'book' ? '' : chapterId;
      const clearTopicId = scope === 'book' ? '' : topicId;
      const clearNodeId = scope === 'book' ? '' : nodeId;
      await aiApi.clearBook({ bookId, chapterId: clearChapterId, topicId: clearTopicId, nodeId: clearNodeId, pageNumber: clearPageNumber, scope });
      setMessages([]);
      toast.success('Chat cleared');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err?.message || 'Failed to clear chat';
      toast.error(msg);
    }
  }, [bookId, chapterId, topicId, nodeId, pageNumber, scope]);

  return {
    messages,
    loading,
    sending,
    send,
    clear,
    refresh
  };
}
