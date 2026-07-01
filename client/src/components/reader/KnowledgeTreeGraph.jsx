import { useEffect, useMemo, useState } from 'react';
import Tree from 'react-d3-tree';
import { HiChevronDown, HiOutlineSparkles } from 'react-icons/hi';
import './KnowledgeTreeGraph.css';

function getNodeId(node) {
  return String(node?.nodeId || node?.topicId || node?.chapterId || node?.title || '');
}

function getChildren(node) {
  return node?.children || node?.subtopics || node?.topics || [];
}

function getNodeType(node) {
  return node?.nodeType || (node?.chapterId ? 'chapter' : 'topic');
}

function toRawNode(node, depth = 0) {
  const children = getChildren(node).map((child) => toRawNode(child, depth + 1)).filter(Boolean);
  const pageRange = node?.pageRange || {};
  return {
    name: node?.title || (depth === 0 ? 'Whole PDF' : 'Untitled'),
    nodeId: getNodeId(node),
    nodeType: getNodeType(node),
    title: node?.title || '',
    pageRange,
    summary: node?.summary || '',
    detailedNotes: node?.detailedNotes || '',
    keyPoints: node?.keyPoints || [],
    definitions: node?.definitions || [],
    examples: node?.examples || [],
    quizQuestions: node?.quizQuestions || [],
    attributes: {
      type: getNodeType(node),
      pages: pageRange.start ? `${pageRange.start}-${pageRange.end || pageRange.start}` : ''
    },
    children: children.length > 0 ? children : undefined
  };
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export default function KnowledgeTreeGraph({
  rootNode,
  selectedNodeId,
  onSelectNode
}) {
  const isDesktop = useDesktopLayout();

  const data = useMemo(() => {
    if (!rootNode) return [];
    return [toRawNode(rootNode)];
  }, [rootNode]);

  const renderCustomNodeElement = ({ nodeDatum, toggleNode }) => {
    const hasChildren = Array.isArray(nodeDatum.children) && nodeDatum.children.length > 0;
    const active = String(selectedNodeId) === String(nodeDatum.nodeId);
    const isRoot = (nodeDatum.nodeType || '').toLowerCase() === 'book' || (nodeDatum.attributes?.type || '').toLowerCase() === 'book';
    const pageLabel = nodeDatum.attributes?.pages || '';
    const typeLabel = nodeDatum.nodeType || nodeDatum.attributes?.type || 'node';

    return (
      <g>
        <foreignObject
          x={-118}
          y={-48}
          width={236}
          height={96}
        >
          <button
            type="button"
            className={`rb-ktree__node ${active ? 'rb-ktree__node--active' : ''} ${isRoot ? 'rb-ktree__node--root' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectNode?.(nodeDatum);
              if (hasChildren) toggleNode();
            }}
          >
            <div className="rb-ktree__node-top">
              <span className="rb-ktree__pill">{typeLabel}</span>
              {hasChildren && (
                <span className="rb-ktree__toggle">
                  <HiChevronDown size={12} />
                </span>
              )}
            </div>
            <div className="rb-ktree__title">{nodeDatum.name}</div>
            <div className="rb-ktree__meta">
              {pageLabel ? `Pages ${pageLabel}` : 'Knowledge node'}
            </div>
            {nodeDatum.summary && (
              <div className="rb-ktree__summary">
                {nodeDatum.summary.slice(0, 90)}
                {nodeDatum.summary.length > 90 ? '…' : ''}
              </div>
            )}
          </button>
        </foreignObject>
      </g>
    );
  };

  if (!isDesktop) {
    return null;
  }

  return (
    <div className="rb-ktree">
      <div className="rb-ktree__header">
        <HiOutlineSparkles size={14} />
        <span>Knowledge Tree</span>
      </div>
      <div className="rb-ktree__canvas">
        {data.length > 0 ? (
          <Tree
            data={data}
            orientation="vertical"
            pathFunc="elbow"
            collapsible={false}
            initialDepth={1}
            translate={{ x: 118, y: 44 }}
            nodeSize={{ x: 260, y: 128 }}
            separation={{ siblings: 1.05, nonSiblings: 1.3 }}
            renderCustomNodeElement={renderCustomNodeElement}
          />
        ) : (
          <div className="rb-ktree__empty">No knowledge tree yet.</div>
        )}
      </div>
    </div>
  );
}
