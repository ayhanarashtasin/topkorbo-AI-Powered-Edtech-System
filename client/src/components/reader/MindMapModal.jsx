import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HiX,
  HiOutlineArrowsExpand,
  HiOutlineArrowRight,
  HiOutlineShare,
  HiOutlineSparkles
} from 'react-icons/hi';
import KnowledgeTreeGraph from './KnowledgeTreeGraph';
import { formatKnowledgeNodeType, getKnowledgeNodeId } from './knowledgeTreeLayout';
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
        <div className="rb-mindmap__state" role="status" aria-live="polite">
          <div className="rb-mindmap__spinner" aria-hidden="true" />
          <p>Loading the mind map…</p>
        </div>
      );
    }

    if (!isReady) {
      return (
        <div className="rb-mindmap__state" role="status" aria-live="polite">
          <HiOutlineSparkles size={30} aria-hidden="true" />
          <p>
            {status === 'failed'
              ? 'The AI could not build a mind map for this book yet.'
              : 'The AI is still preparing the mind map for this book. Please check back in a moment.'}
          </p>
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
          aria-label="Selected concept details"
        >
          {selectedNode ? (
            <>
              <div className="rb-mindmap__detail-head">
                <span className="rb-mindmap__pill">
                  {formatKnowledgeNodeType(selectedNode.nodeType || selectedNode.attributes?.type || 'topic')}
                </span>
                <div className="rb-mindmap__detail-actions">
                  {startPage ? (
                    <button type="button" className="rb-mindmap__jump" onClick={handleJump}>
                      <span>
                        Pages {pageRange.start}
                        {pageRange.end && pageRange.end !== pageRange.start ? `–${pageRange.end}` : ''}
                      </span>
                      <HiOutlineArrowRight size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rb-mindmap__detail-close"
                    onClick={() => setSelectedNode(null)}
                    aria-label="Close concept details"
                  >
                    <HiX size={16} />
                  </button>
                </div>
              </div>

              <h3 className="rb-mindmap__detail-title">{selectedNode.name || selectedNode.title}</h3>

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
                <section className="rb-mindmap__section">
                  <h4>Definitions</h4>
                  <ul>
                    {selectedNode.definitions.map((definition, index) => <li key={index}>{definition}</li>)}
                  </ul>
                </section>
              ) : null}

              {Array.isArray(selectedNode.examples) && selectedNode.examples.length > 0 ? (
                <section className="rb-mindmap__section">
                  <h4>Examples</h4>
                  <ul>
                    {selectedNode.examples.map((example, index) => <li key={index}>{example}</li>)}
                  </ul>
                </section>
              ) : null}
            </>
          ) : (
            <div className="rb-mindmap__detail-empty">
              <HiOutlineShare size={26} aria-hidden="true" />
              <p>Select a concept to see its summary, key points, and matching pages.</p>
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
          <div className="rb-mindmap__header-title">
            <span className="rb-mindmap__header-mark" aria-hidden="true">
              <HiOutlineShare size={18} />
            </span>
            <div>
              <h2 id="rb-mindmap-title">Mind map{rootNode?.title ? ` · ${rootNode.title}` : ''}</h2>
              <small id="rb-mindmap-instructions">
                Follow the colors from book to chapter, then open a branch to explore.
              </small>
            </div>
          </div>

          <div className="rb-mindmap__header-actions">
            <button
              type="button"
              className="rb-mindmap__action"
              onClick={() => setIsExpanded((value) => !value)}
              aria-label={isExpanded ? 'Exit full-screen mind map' : 'Open full-screen mind map'}
              aria-pressed={isExpanded}
            >
              <HiOutlineArrowsExpand size={15} />
              {isExpanded ? 'Windowed' : 'Full screen'}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className="rb-mindmap__close"
              onClick={handleClose}
              aria-label="Close mind map"
            >
              <HiX size={18} />
            </button>
          </div>
        </header>
        {renderBody()}
      </div>
    </div>
  );
}
