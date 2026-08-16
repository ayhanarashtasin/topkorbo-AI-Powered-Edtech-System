import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  HiX,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineBookOpen,
  HiOutlineClipboardList,
  HiOutlineQuestionMarkCircle,
  HiOutlineAcademicCap,
  HiOutlineLightBulb,
  HiOutlineCursorClick
} from 'react-icons/hi';
import './ChatSidebar.css';

const MODE_LABELS = {
  page: 'Current Page',
  book: 'Full Book'
};

const QUICK_ACTIONS = [
  { id: 'summary-page', label: 'Summarize Page', scope: 'page', requestedAction: 'summary', question: 'Summarize this page', icon: HiOutlineClipboardList },
  { id: 'summary-book', label: 'Summarize Book', scope: 'book', requestedAction: 'summary', question: 'Summarize the whole book', icon: HiOutlineBookOpen },
  { id: 'simple', label: 'Explain Simply', scope: 'book', requestedAction: 'simple', question: 'Explain this simply', icon: HiOutlineAcademicCap },
  { id: 'key-points', label: 'Key Points', scope: 'book', requestedAction: 'notes', question: 'Give key points from this book', icon: HiOutlineLightBulb },
  { id: 'quiz', label: 'Generate Quiz', scope: 'book', requestedAction: 'quiz', question: 'Generate a quiz from this book', icon: HiOutlineQuestionMarkCircle },
  { id: 'ask-page', label: 'Ask from Current Page', scope: 'page', requestedAction: 'answer', question: 'Ask about this page', icon: HiOutlineCursorClick },
  { id: 'ask-book', label: 'Ask from Full Book', scope: 'book', requestedAction: 'answer', question: 'Ask about the whole book', icon: HiOutlineBookOpen }
];

export default function ChatSidebar({
  isOpen,
  onClose,
  messages = [],
  loading = false,
  sending = false,
  pageNumber,
  scope = 'page',
  onScopeChange,
  pageTextReady = false,
  getPageText = () => '',
  onSend,
  onClear,
  onQuickAction,
  onSourceClick
}) {
  const [draft, setDraft] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const quickActionsRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, messages, sending]);

  useEffect(() => {
    if (!showQuickActions) return;
    const handleClickOutside = (e) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target)) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showQuickActions]);

  if (!isOpen) return null;

  const canSend = !sending && draft.trim().length > 0 && (scope !== 'page' || pageTextReady);
  const contextLabel = MODE_LABELS[scope] || 'Current Page';

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (onSend) {
      await onSend(text, scope === 'page' ? getPageText() : '');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleQuickAction = async (action) => {
    if (!action) return;
    if (onQuickAction) {
      onQuickAction(action);
      return;
    }
    await onSend?.(
      action.question,
      action.scope === 'page' ? getPageText() : '',
      {
        requestedAction: action.requestedAction,
        scopeOverride: action.scope
      }
    );
  };

  const getSourceLabel = (message) => {
    const pages = Array.isArray(message?.sources) ? message.sources : [];
    if (pages.length) return pages.map((item) => item.label || `Page ${item.pageNumber}`).join(', ');
    const match = String(message?.content || '').match(/Sources:\s*([\s\S]*)$/i);
    if (!match) return '';
    return match[1].split('\n').map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean).join(', ');
  };

  const getCardTitle = (message) => {
    const action = String(message?.action || '').toLowerCase();
    if (action === 'summary') return 'AI Summary';
    if (action === 'quiz') return 'AI Quiz';
    return 'AI Answer';
  };

  const getContextUsed = (message) => {
    const context = String(message?.contextLabel || '').trim();
    if (context) return context;
    const type = String(message?.contextType || '').toLowerCase();
    if (type === 'page') return 'Current Page';
    if (type === 'chapter') return 'Chapter';
    if (type === 'topic') return 'Selected Topic';
    if (type === 'node') return 'Selected Node';
    return scope === 'page' ? 'Current Page' : 'Full Book';
  };

  const renderMessageContent = (message) => {
    const text = String(message?.content || '');
    const quizMatch = text.match(/(?:^|\n)quiz(?: questions)?[:\s-]*([\s\S]*)/i);
    if (quizMatch && /1\./.test(quizMatch[1])) {
      const items = quizMatch[1]
        .split(/\n(?=\d+\.)/)
        .map((item) => item.trim())
        .filter(Boolean);
      return (
        <div className="rb-chat-quiz">
          {items.map((item, index) => (
            <div key={`${message._id || 'quiz'}-${index}`} className="rb-chat-quiz-card">
              <div className="rb-chat-quiz-title">Question {index + 1}</div>
              <div className="rb-chat-quiz-body">{item}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    );
  };

  return (
    <aside className="rb-chat-sidebar" aria-label="AI tutor chat">
      <div className="rb-chat-shell">
        <div className="rb-chat-header">
          <div className="rb-chat-header__title">
            <div>
              <h3>AI Tutor</h3>
              <p>Ask from current page or full book</p>
            </div>
          </div>
          <div className="rb-chat-sidebar-actions">
            <button
              type="button"
              onClick={onClear}
              disabled={messages.length === 0 || sending}
              title="Clear this chat"
              aria-label="Clear chat"
            >
              <HiOutlineTrash size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close chat"
              aria-label="Close chat"
            >
              <HiX size={18} />
            </button>
          </div>
        </div>

        <div className="rb-chat-mode-row" role="tablist" aria-label="AI tutor mode">
          {Object.entries(MODE_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rb-chat-mode-pill ${scope === key ? 'rb-chat-mode-pill--active' : ''}`}
              onClick={() => onScopeChange?.(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rb-chat-content" ref={listRef}>
          {loading && messages.length === 0 ? (
            <div className="rb-chat-empty">
              <div className="rb-chat-spinner" />
              <p>Preparing your answer...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="rb-chat-empty">
              <strong>Ask anything from this page or the full book.</strong>
              <p>The tutor will answer using the selected reading context and show sources.</p>
            </div>
          ) : (
            messages.map((m) =>
              m.role === 'assistant' ? (
                <div
                  key={m._id || `${m.role}-${m.createdAt}`}
                  className="rb-chat-answer-card"
                >
                  <div className="rb-chat-answer-card__head">
                    <div className="rb-chat-answer-card__head-main">
                      <span>{getCardTitle(m)}</span>
                      <small>Context used: {getContextUsed(m)}</small>
                    </div>
                    {m.action === 'quiz' && <small className="rb-chat-answer-card__badge">Quiz</small>}
                  </div>
                  <div className="rb-chat-answer-card__body rb-chat-markdown">
                    {renderMessageContent(m)}
                  </div>
                  {getSourceLabel(m) && (
                    <div className="rb-chat-answer-card__footer">
                      <span>Sources:</span>{' '}
                      {Array.isArray(m.sources) && m.sources.length > 0 ? (
                        m.sources.map((source, index) => (
                          <button
                            key={`${source.pageNumber}-${index}`}
                            type="button"
                            className="rb-chat-source-btn"
                            onClick={() => onSourceClick?.(source.pageNumber)}
                          >
                            {source.label || `Page ${source.pageNumber}`}
                          </button>
                        ))
                      ) : (
                        getSourceLabel(m)
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  key={m._id || `${m.role}-${m.createdAt}`}
                  className={`rb-chat-message rb-chat-message--${m.role}`}
                >
                  {m.content}
                </div>
              )
            )
          )}
          {sending && (
            <div className="rb-chat-typing" aria-label="AI tutor is typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        <div className="rb-chat-footer">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={
              scope === 'page'
                ? (pageTextReady ? `Ask a question about page ${pageNumber}...` : 'Waiting for the page text to load...')
                : 'Ask a question about the full book...'
            }
            rows={2}
            disabled={sending || (scope === 'page' && !pageTextReady)}
            aria-label="Type your question"
          />
          <div className="rb-chat-footer-row">
            <span className={`rb-chat-footer-context ${scope === 'page' && !pageTextReady ? 'rb-chat-footer-context--missing' : ''}`}>
              Context: {contextLabel}
            </span>
            <div className="rb-chat-footer-actions" ref={quickActionsRef}>
              <button
                type="button"
                className={`rb-chat-quick-trigger ${showQuickActions ? 'rb-chat-quick-trigger--active' : ''}`}
                onClick={() => setShowQuickActions((prev) => !prev)}
                aria-label="Quick actions"
                title="Quick actions"
              >
                <HiOutlineLightBulb size={15} />
              </button>
              {showQuickActions && (
                <div className="rb-chat-quick-popover">
                  <div className="rb-chat-quick-popover-title">Quick actions</div>
                  <div className="rb-chat-quick-list">
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className="rb-chat-quick-item"
                          onClick={() => {
                            setShowQuickActions(false);
                            handleQuickAction(action);
                          }}
                        >
                          <Icon size={14} />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button
                type="button"
                className="rb-chat-send-btn"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send question"
              >
                <HiOutlinePaperAirplane size={14} />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
