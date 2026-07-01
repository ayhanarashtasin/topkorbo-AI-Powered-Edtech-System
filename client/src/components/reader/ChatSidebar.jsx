import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  HiX,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineSparkles
} from 'react-icons/hi';
import './ChatSidebar.css';

// Right-side drawer with the AI tutor conversation. User bubbles are plain
// text; assistant bubbles render through `react-markdown` so headings,
// lists, bold etc. display correctly.
export default function ChatSidebar({
  isOpen,
  onClose,
  messages = [],
  loading = false,
  sending = false,
  pageNumber,
  pageTextReady = false,
  getPageText = () => '',
  onSend,
  onClear
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll the message list to the newest message on each update.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, messages, sending]);

  // Clear the draft when the sidebar closes so reopening starts fresh.
  useEffect(() => {
    if (!isOpen) setDraft('');
  }, [isOpen]);

  if (!isOpen) return null;

  const canSend = pageTextReady && !sending && draft.trim().length > 0;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (onSend) {
      await onSend(text, getPageText());
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
    // Auto-grow the textarea up to its CSS max-height.
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  return (
    <aside className="rb-chat-sidebar" aria-label="AI tutor chat">
      <div className="rb-chat-sidebar-header">
        <div>
          <h3>
            <HiOutlineSparkles className="rb-chat-icon" size={18} />
            AI Tutor
          </h3>
          <div className="rb-chat-sidebar-context">
            {pageNumber ? `Page ${pageNumber} · answers use this page's text` : 'Pick a page to start'}
          </div>
        </div>
        <div className="rb-chat-sidebar-actions">
          <button
            type="button"
            onClick={onClear}
            disabled={messages.length === 0 || sending}
            title="Clear this page's chat"
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

      <div className="rb-chat-sidebar-content" ref={listRef}>
        {loading && messages.length === 0 ? (
          <div className="rb-chat-empty">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="rb-chat-empty">
            <strong>Ask anything about this page.</strong>
            <br />
            The tutor will read the page you're on and answer your question.
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'assistant' ? (
              <div
                key={m._id || `${m.role}-${m.createdAt}`}
                className="rb-chat-message rb-chat-message--assistant rb-chat-markdown"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {m.content}
                </ReactMarkdown>
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
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>

      <div className="rb-chat-sidebar-footer">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder={
            pageTextReady
              ? `Ask a question about page ${pageNumber}…`
              : 'Waiting for the page text to load…'
          }
          rows={2}
          disabled={!pageTextReady || sending}
          aria-label="Type your question"
        />
        <div className="rb-chat-footer-row">
          <span
            className={`rb-chat-page-hint ${pageTextReady ? '' : 'rb-chat-page-hint--missing'}`}
          >
            {pageTextReady
              ? 'Context: current page'
              : 'Page text not ready yet'}
          </span>
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
    </aside>
  );
}