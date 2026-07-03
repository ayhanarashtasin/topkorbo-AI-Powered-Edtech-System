import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiX,
  HiOutlineShare,
  HiOutlineArrowRight,
  HiOutlineSparkles
} from 'react-icons/hi';
import KnowledgeTreeGraph from './KnowledgeTreeGraph';
import './MindMapModal.css';

// Chapter tree nodes are keyed as `chapter-<id>` or `document-<id>`; extract
// the owning chapter id from any node id that follows that convention.
function extractChapterId(nodeId) {
  const match = String(nodeId || '').match(/^(?:chapter|document)-(.+)$/);
  return match ? match[1] : '';
}

// Walk the tree once and map every descendant nodeId to the chapter it lives
// under, so clicking a topic can jump to the right chapter PDF.
function buildChapterIndex(rootNode) {
  const index = {};
  const children = rootNode?.children || rootNode?.subtopics || rootNode?.topics || [];
  for (const chapterNode of children) {
    const chapterId = chapterNode?.chapterId || extractChapterId(chapterNode?.nodeId);
    if (!chapterId) continue;
    const stack = [chapterNode];
    while (stack.length) {
      const current = stack.pop();
      const id = current?.nodeId || current?.topicId || current?.chapterId;
      if (id) index[String(id)] = chapterId;
      const kids = current?.children || current?.subtopics || current?.topics || [];
      for (const kid of kids) stack.push(kid);
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

  // Clear the detail panel as we close so the next open starts fresh (the
  // modal stays mounted, so we reset here rather than on open).
  const handleClose = useCallback(() => {
    setSelectedNode(null);
    onClose?.();
  }, [onClose]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  const chapterIndex = useMemo(() => buildChapterIndex(rootNode), [rootNode]);

  if (!isOpen) return null;

  const isReady = status === 'completed' && rootNode;
  const pageRange = selectedNode?.pageRange || {};
  const startPage = Number(pageRange.start) || null;
  const owningChapterId = selectedNode
    ? chapterIndex[String(selectedNode.nodeId)] || extractChapterId(selectedNode.nodeId)
    : '';

  const handleJump = () => {
    if (!startPage) return;
    onJumpTo?.({ chapterId: owningChapterId, page: startPage });
    handleClose();
  };

  const renderBody = () => {
    if (loading && !rootNode) {
      return (
        <div className="rb-mindmap__state">
          <div className="rb-mindmap__spinner" />
          <p>Loading the mind map…</p>
        </div>
      );
    }
    if (!isReady) {
      return (
        <div className="rb-mindmap__state">
          <HiOutlineSparkles size={30} />
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
            selectedNodeId={selectedNode?.nodeId}
            onSelectNode={setSelectedNode}
            showOnMobile
          />
        </div>
        <aside className="rb-mindmap__detail">
          {selectedNode ? (
            <>
              <div className="rb-mindmap__detail-head">
                <span className="rb-mindmap__pill">
                  {selectedNode.nodeType || selectedNode.attributes?.type || 'node'}
                </span>
                {startPage && (
                  <button type="button" className="rb-mindmap__jump" onClick={handleJump}>
                    <span>Go to pages {pageRange.start}{pageRange.end ? `–${pageRange.end}` : ''}</span>
                    <HiOutlineArrowRight size={14} />
                  </button>
                )}
              </div>
              <h3 className="rb-mindmap__detail-title">{selectedNode.name || selectedNode.title}</h3>

              {selectedNode.summary && (
                <p className="rb-mindmap__summary">{selectedNode.summary}</p>
              )}

              {Array.isArray(selectedNode.keyPoints) && selectedNode.keyPoints.length > 0 && (
                <section className="rb-mindmap__section">
                  <h4>Key Points</h4>
                  <ul>
                    {selectedNode.keyPoints.map((point, i) => <li key={i}>{point}</li>)}
                  </ul>
                </section>
              )}

              {Array.isArray(selectedNode.definitions) && selectedNode.definitions.length > 0 && (
                <section className="rb-mindmap__section">
                  <h4>Definitions</h4>
                  <ul>
                    {selectedNode.definitions.map((def, i) => <li key={i}>{def}</li>)}
                  </ul>
                </section>
              )}

              {Array.isArray(selectedNode.examples) && selectedNode.examples.length > 0 && (
                <section className="rb-mindmap__section">
                  <h4>Examples</h4>
                  <ul>
                    {selectedNode.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <div className="rb-mindmap__detail-empty">
              <HiOutlineShare size={26} />
              <p>Tap any node to see its summary, key points, and jump to those pages.</p>
            </div>
          )}
        </aside>
      </div>
    );
  };

  return (
    <div className="rb-mindmap__overlay" onClick={handleClose}>
      <div className="rb-mindmap" onClick={(e) => e.stopPropagation()}>
        <header className="rb-mindmap__header">
          <div className="rb-mindmap__header-title">
            <HiOutlineShare size={18} />
            <span>Mind Map{rootNode?.title ? ` · ${rootNode.title}` : ''}</span>
          </div>
          <button type="button" className="rb-mindmap__close" onClick={handleClose} aria-label="Close mind map">
            <HiX size={18} />
          </button>
        </header>
        {renderBody()}
      </div>
    </div>
  );
}
