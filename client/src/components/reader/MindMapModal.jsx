import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HiX,
  HiOutlineArrowsExpand,
  HiOutlineArrowRight
} from 'react-icons/hi';
import KnowledgeTreeGraph from './KnowledgeTreeGraph';
import { formatKnowledgeNodeType, getKnowledgeNodeId, normalizeKnowledgeNodeType } from './knowledgeTreeLayout';
import './MindMapModal.css';

// Chapter tree nodes are keyed as `chapter-<id>` or `document-<id>`; extract
// the owning chapter id from any node id that follows that convention.
function extractChapterId(nodeId) {
  const match = String(nodeId || '').match(/^(?:chapter|document)-(.+)$/);
  return match ? match[1] : '';
}

// Walk the tree once and map every descendant node to the chapter it belongs
// to, so selecting a concept can jump to the correct chapter PDF.
function buildChapterIndex(rootNode) {
  const index = {};
  const children = rootNode?.children || rootNode?.subtopics || rootNode?.topics || [];
  for (const chapterNode of children) {
    const chapterId = chapterNode?.chapterId || extractChapterId(chapterNode?.nodeId);
    if (!chapterId) continue;
    const stack = [chapterNode];
    while (stack.length) {
      const current = stack.pop();
      const id = getKnowledgeNodeId(current);
      if (id) index[id] = chapterId;
      const descendants = current?.children || current?.subtopics || current?.topics || [];
      for (const descendant of descendants) stack.push(descendant);
    }
  }
  return index;
}

export default function MindMapModal({
  isOpen,
  onClose,
  rootNode,
  status = 'completed',
  loading = false,
  onJumpTo
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const closeButtonRef = useRef(null);

  const handleClose = useCallback(() => {
    setSelectedNode(null);
    setIsExpanded(false);
    onClose?.();
  }, [onClose]);

  // Move focus into the modal, restore it on close, and lock background scrolling.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => {
      if (event.key === 'Escape') handleClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, handleClose]);

  const chapterIndex = useMemo(() => buildChapterIndex(rootNode), [rootNode]);

  if (!isOpen) return null;

  const isReady = status === 'completed' && rootNode;
  const selectedNodeId = getKnowledgeNodeId(selectedNode);
  const pageRange = selectedNode?.pageRange || {};
  const startPage = Number(pageRange.start) || null;
  const owningChapterId = selectedNode
    ? chapterIndex[selectedNodeId] || extractChapterId(selectedNodeId)
    : '';

  const handleJump = () => {
    if (!startPage) return;
    onJumpTo?.({ chapterId: owningChapterId, page: startPage });
    handleClose();
  };

  const renderBody = () => {
    if (loading && !rootNode) {
      return (
        <div className="rb-mindmap__state rb-mindmap__state--loading" role="status" aria-live="polite">
          <div className="rb-mindmap__skeleton">
            <div className="rb-mindmap__skeleton-node" />
            <div className="rb-mindmap__skeleton-line" />
            <div className="rb-mindmap__skeleton-node rb-mindmap__skeleton-node--sm" />
            <div className="rb-mindmap__skeleton-line rb-mindmap__skeleton-line--short" />
            <div className="rb-mindmap__skeleton-node rb-mindmap__skeleton-node--sm" />
          </div>
          <p>Building your knowledge map…</p>
        </div>
      );
    }

    if (!isReady) {
      if (status === 'failed') {
        return (
          <div className="rb-mindmap__state rb-mindmap__state--error" role="status" aria-live="polite">
            <div className="rb-mindmap__state-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <strong>Couldn't build the knowledge map</strong>
            <p>The AI wasn't able to process this book yet. This usually resolves on its own — try again in a few minutes.</p>
          </div>
        );
      }
      return (
        <div className="rb-mindmap__state rb-mindmap__state--pending" role="status" aria-live="polite">
          <div className="rb-mindmap__pulse" aria-hidden="true" />
          <strong>Analyzing your book</strong>
          <p>The AI is building a knowledge map from this book's content. This may take a moment.</p>
        </div>
      );
    }

    return (
      <div className="rb-mindmap__body">
        <div className="rb-mindmap__graph">
          <KnowledgeTreeGraph
            rootNode={rootNode}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNode}
            showOnMobile
          />
        </div>

        <aside
          className={`rb-mindmap__detail ${selectedNode ? 'rb-mindmap__detail--active' : 'rb-mindmap__detail--empty'}`}
          data-node-type={selectedNode ? normalizeKnowledgeNodeType(selectedNode.nodeType || selectedNode.attributes?.type || 'topic') : undefined}
          aria-label="Selected concept details"
        >
          {selectedNode ? (
            <>
              <div className="rb-mindmap__detail-head">
                <span className="rb-mindmap__pill">
                  {formatKnowledgeNodeType(selectedNode.nodeType || selectedNode.attributes?.type || 'topic')}
                </span>
                <button
                  type="button"
                  className="rb-mindmap__detail-close"
                  onClick={() => setSelectedNode(null)}
                  aria-label="Close concept details"
                >
                  <HiX size={16} />
                </button>
              </div>

              <h3 className="rb-mindmap__detail-title">{selectedNode.name || selectedNode.title}</h3>
              
              {startPage ? (
                <button type="button" className="rb-mindmap__jump" onClick={handleJump}>
                  Pages {pageRange.start}
                  {pageRange.end && pageRange.end !== pageRange.start ? `–${pageRange.end}` : ''} →
                </button>
              ) : null}

              {selectedNode.summary ? (
                <p className="rb-mindmap__summary">{selectedNode.summary}</p>
              ) : null}

              {Array.isArray(selectedNode.keyPoints) && selectedNode.keyPoints.length > 0 ? (
                <section className="rb-mindmap__section">
                  <h4>Key points</h4>
                  <ul>
                    {selectedNode.keyPoints.map((point, index) => <li key={index}>{point}</li>)}
                  </ul>
                </section>
              ) : null}

              {Array.isArray(selectedNode.definitions) && selectedNode.definitions.length > 0 ? (
                <section className="rb-mindmap__section rb-mindmap__section--definitions">
                  <h4>Definitions</h4>
                  <ul>
                    {selectedNode.definitions.map((definition, index) => <li key={index}>{definition}</li>)}
                  </ul>
                </section>
              ) : null}

              {Array.isArray(selectedNode.examples) && selectedNode.examples.length > 0 ? (
                <section className="rb-mindmap__section rb-mindmap__section--examples">
                  <h4>Examples</h4>
                  <ul>
                    {selectedNode.examples.map((example, index) => <li key={index}>{example}</li>)}
                  </ul>
                </section>
              ) : null}

              {startPage ? (
                <div className="rb-mindmap__action-bar">
                  <button type="button" className="rb-mindmap__jump rb-mindmap__jump--full" onClick={handleJump}>
                    Jump to Page {pageRange.start}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rb-mindmap__detail-empty">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="rb-mindmap__empty-icon">
                <circle cx="8" cy="4" r="2" fill="currentColor" />
                <circle cx="4" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M8 6v2M6.5 9.5L4.5 10.5M9.5 9.5L11.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>Select any concept to explore its details, key points, and page references.</p>
            </div>
          )}
        </aside>
      </div>
    );
  };

  return (
    <div
      className="rb-mindmap__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        className={`rb-mindmap ${isExpanded ? 'rb-mindmap--expanded' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rb-mindmap-title"
        aria-describedby="rb-mindmap-instructions"
      >
        <header className="rb-mindmap__header">
          <div className="rb-mindmap__header-left">
            <span className="rb-mindmap__header-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="4" r="2" fill="currentColor" />
                <circle cx="4" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M8 6v2M6.5 9.5L4.5 10.5M9.5 9.5L11.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className="rb-mindmap__header-text">
              <h2 id="rb-mindmap-title">
                {rootNode?.title ? rootNode.title : 'Knowledge Map'}
              </h2>
              <p id="rb-mindmap-instructions">
                {selectedNode 
                  ? `${formatKnowledgeNodeType(selectedNode.nodeType || selectedNode.attributes?.type || 'topic')} · ${selectedNode.name || selectedNode.title}`
                  : 'Explore concepts and their connections'
                }
              </p>
            </div>
          </div>
          <div className="rb-mindmap__header-actions">
            <button
              type="button"
              className="rb-mindmap__header-btn"
              onClick={() => setIsExpanded((v) => !v)}
              aria-label={isExpanded ? 'Exit full screen' : 'Full screen'}
              aria-pressed={isExpanded}
              title={isExpanded ? 'Exit full screen' : 'Full screen'}
            >
              <HiOutlineArrowsExpand size={15} />
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="rb-mindmap__header-btn rb-mindmap__header-btn--close"
              onClick={handleClose}
              aria-label="Close knowledge map"
              title="Close"
            >
              <HiX size={16} />
            </button>
          </div>
        </header>
        {renderBody()}
      </div>
    </div>
  );
}
