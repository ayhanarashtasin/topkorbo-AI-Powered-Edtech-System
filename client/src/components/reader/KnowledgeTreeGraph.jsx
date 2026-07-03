import { useEffect, useMemo, useState } from 'react';
import Tree from 'react-d3-tree';
import { HiOutlineSparkles } from 'react-icons/hi';
import './KnowledgeTreeGraph.css';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;
const NODE_GAP_X = 330;
const NODE_GAP_Y = 230;

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

function getTreeLayoutStats(node, depth = 0) {
  if (!node) return { maxDepth: 0, leafCount: 1 };
  const children = getChildren(node);
  if (!children.length) return { maxDepth: depth, leafCount: 1 };

  return children.reduce((stats, child) => {
    const childStats = getTreeLayoutStats(child, depth + 1);
    return {
      maxDepth: Math.max(stats.maxDepth, childStats.maxDepth),
      leafCount: stats.leafCount + childStats.leafCount
    };
  }, { maxDepth: depth, leafCount: 0 });
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
  onSelectNode,
  showOnMobile = false
}) {
  const isDesktop = useDesktopLayout();

  const data = useMemo(() => {
    if (!rootNode) return [];
    return [toRawNode(rootNode)];
  }, [rootNode]);

  const layout = useMemo(() => {
    const { maxDepth, leafCount } = getTreeLayoutStats(rootNode);
    const leftExtent = Math.max(0, leafCount - 1) * NODE_GAP_X / 2;
    const width = Math.max(820, (leftExtent * 2) + NODE_WIDTH + 80);
    const height = Math.max(520, (maxDepth * NODE_GAP_Y) + NODE_HEIGHT + 120);

    return {
      dimensions: { width, height },
      translate: { x: leftExtent + (NODE_WIDTH / 2) + 40, y: 62 }
    };
  }, [rootNode]);

  const renderCustomNodeElement = ({ nodeDatum }) => {
    const active = String(selectedNodeId) === String(nodeDatum.nodeId);
    const isRoot = (nodeDatum.nodeType || '').toLowerCase() === 'book' || (nodeDatum.attributes?.type || '').toLowerCase() === 'book';
    const pageLabel = nodeDatum.attributes?.pages || '';
    const typeLabel = nodeDatum.nodeType || nodeDatum.attributes?.type || 'node';
    const normalizedType = String(typeLabel).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const isPoint = normalizedType === 'point';
    const previewPoints = Array.isArray(nodeDatum.keyPoints)
      ? nodeDatum.keyPoints.filter(Boolean).slice(0, 3)
      : [];

    return (
      <g>
        <foreignObject
          x={-150}
          y={-64}
          width={300}
          height={NODE_HEIGHT}
        >
          <button
            type="button"
            className={`rb-ktree__node rb-ktree__node--${normalizedType} ${active ? 'rb-ktree__node--active' : ''} ${isRoot ? 'rb-ktree__node--root' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectNode?.(nodeDatum);
            }}
          >
            <div className="rb-ktree__node-top">
              <span className="rb-ktree__pill">{typeLabel}</span>
            </div>
            <div className="rb-ktree__title">{nodeDatum.name}</div>
            <div className="rb-ktree__meta">
              {pageLabel ? `Pages ${pageLabel}` : 'Knowledge node'}
            </div>
            {!isPoint && previewPoints.length > 0 ? (
              <ul className="rb-ktree__points">
                {previewPoints.map((point, idx) => <li key={idx}>{point}</li>)}
              </ul>
            ) : nodeDatum.summary && (
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

  if (!isDesktop && !showOnMobile) {
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
          <div
            className="rb-ktree__stage"
            style={{ width: layout.dimensions.width, height: layout.dimensions.height }}
          >
            <Tree
              data={data}
              dimensions={layout.dimensions}
              orientation="vertical"
              pathFunc="elbow"
              collapsible={false}
              translate={layout.translate}
              nodeSize={{ x: NODE_GAP_X, y: NODE_GAP_Y }}
              separation={{ siblings: 1, nonSiblings: 1.2 }}
              renderCustomNodeElement={renderCustomNodeElement}
            />
          </div>
        ) : (
          <div className="rb-ktree__empty">No knowledge tree yet.</div>
        )}
      </div>
    </div>
  );
}
