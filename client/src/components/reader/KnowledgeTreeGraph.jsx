import { useEffect, useMemo, useState } from 'react';
import Tree from 'react-d3-tree';
import { HiOutlineSparkles, HiOutlineZoomIn, HiOutlineZoomOut } from 'react-icons/hi';
import './KnowledgeTreeGraph.css';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 156;
// react-d3-tree (horizontal) builds the layout with
// d3.tree().nodeSize([nodeSize.y, nodeSize.x]), so `nodeSize.x` becomes the gap
// between depth levels (horizontal on screen) and `nodeSize.y` the gap between
// siblings (vertical). Both must stay comfortably larger than the card box or
// neighbouring cards overlap. Keep depth spacing > NODE_WIDTH and sibling
// spacing > NODE_HEIGHT with room to spare.
const DEPTH_SPACING = 420;   // horizontal distance between parent and child levels
const SIBLING_SPACING = 210; // vertical distance between sibling cards
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.15;

function getNodeId(node) {
  return String(node?.nodeId || node?.topicId || node?.chapterId || node?.title || '');
}

function getChildren(node) {
  return node?.children || node?.subtopics || node?.topics || [];
}

function getNodeType(node) {
  return node?.nodeType || (node?.chapterId ? 'chapter' : 'topic');
}

function toRawNode(node, depth = 0, index = 1) {
  const children = getChildren(node)
    .map((child, childIndex) => toRawNode(child, depth + 1, childIndex + 1))
    .filter(Boolean);
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
    stepLabel: depth === 0 ? 'Start' : `Step ${depth}.${index}`,
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
  const [zoom, setZoom] = useState(0.78);

  const data = useMemo(() => {
    if (!rootNode) return [];
    return [toRawNode(rootNode)];
  }, [rootNode]);

  const layout = useMemo(() => {
    const { maxDepth, leafCount } = getTreeLayoutStats(rootNode);
    const width = Math.max(980, (maxDepth * DEPTH_SPACING) + NODE_WIDTH + 280);
    const height = Math.max(560, (Math.max(1, leafCount) * SIBLING_SPACING) + NODE_HEIGHT + 160);

    return {
      dimensions: { width, height },
      // Leave room on the left so the root card (centred on the node point) is
      // fully visible instead of being clipped by the canvas edge.
      translate: { x: (NODE_WIDTH / 2) + 48, y: height / 2 }
    };
  }, [rootNode]);

  const setBoundedZoom = (nextZoom) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom.toFixed(2)))));
  };

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
          x={-NODE_WIDTH / 2}
          y={-NODE_HEIGHT / 2}
          width={NODE_WIDTH}
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
              <span className="rb-ktree__step">{nodeDatum.stepLabel}</span>
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
        <div className="rb-ktree__header-title">
          <HiOutlineSparkles size={14} />
          <span>Step Graph</span>
        </div>
        <div className="rb-ktree__zoom" aria-label="Mind map zoom controls">
          <button
            type="button"
            onClick={() => setBoundedZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <HiOutlineZoomOut size={14} />
          </button>
          <button type="button" onClick={() => setBoundedZoom(0.78)} aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setBoundedZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <HiOutlineZoomIn size={14} />
          </button>
        </div>
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
              orientation="horizontal"
              pathFunc="diagonal"
              pathClassFunc={() => 'rb-ktree__link'}
              collapsible={false}
              zoomable
              draggable
              zoom={zoom}
              scaleExtent={{ min: MIN_ZOOM, max: MAX_ZOOM }}
              translate={layout.translate}
              nodeSize={{ x: DEPTH_SPACING, y: SIBLING_SPACING }}
              separation={{ siblings: 1.15, nonSiblings: 1.5 }}
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
