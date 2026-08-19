import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tree from 'react-d3-tree';
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineRefresh,
  HiOutlineZoomIn,
  HiOutlineZoomOut
} from 'react-icons/hi';
import {
  TREE_NODE_SIZE,
  TREE_ZOOM,
  buildVisibleKnowledgeTree,
  calculateTreeFit,
  clampTreeZoom,
  formatKnowledgeNodeType,
  getDefaultExpandedNodeIds,
  getKnowledgeNodeChildren,
  getKnowledgeNodeId,
  getKnowledgeNodeType,
  getVisibleTreeKey,
  normalizeKnowledgeNodeType
} from './knowledgeTreeLayout';
import './KnowledgeTreeGraph.css';

const MAP_LEGEND = [
  { type: 'book', label: 'Book' },
  { type: 'document', label: 'Document' },
  { type: 'topic', label: 'Topic' },
  { type: 'subtopic', label: 'Subtopic' },
  { type: 'point', label: 'Key Point' }
];

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

function useElementDimensions(ref) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      const next = element.getBoundingClientRect();
      const width = Math.round(next.width);
      const height = Math.round(next.height);
      setDimensions((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return dimensions;
}

function NodeTypeLegend() {
  return (
    <div className="rb-ktree__legend" aria-label="Concept map key">
      {MAP_LEGEND.map((item) => (
        <span key={item.type} className={`rb-ktree__legend-item rb-ktree__legend-item--${item.type}`}>
          <i aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function KnowledgeNodeCard({ nodeDatum, active, onSelect, onToggle }) {
  const type = normalizeKnowledgeNodeType(nodeDatum.nodeType || nodeDatum.attributes?.type);
  const typeLabel = formatKnowledgeNodeType(type);
  const pageLabel = nodeDatum.attributes?.pages || '';
  
  let metaText = '';
  if (type === 'book' || type === 'document') {
    metaText = nodeDatum.childCount === 1 ? `1 ${type === 'book' ? 'document' : 'chapter'}` : `${nodeDatum.childCount} ${type === 'book' ? 'documents' : 'chapters'}`;
  } else if (type === 'topic') {
    const branches = nodeDatum.childCount === 1 ? '1 branch' : `${nodeDatum.childCount} branches`;
    metaText = pageLabel ? `p. ${pageLabel} · ${branches}` : branches;
  } else if (type === 'subtopic') {
    metaText = nodeDatum.childCount === 1 ? '1 key point' : `${nodeDatum.childCount} key points`;
  } else {
    metaText = pageLabel ? `p. ${pageLabel} · View details` : 'View details';
  }

  return (
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      className={`rb-ktree__node rb-ktree__node--${type} ${active ? 'rb-ktree__node--active' : ''}`}
    >
      <button
        type="button"
        className="rb-ktree__node-select"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(nodeDatum);
        }}
        aria-pressed={active}
        aria-label={nodeDatum.name}
      >
        <span className="rb-ktree__node-top">
          <span className="rb-ktree__node-icon" aria-hidden="true" />
          <span className="rb-ktree__pill">{typeLabel}</span>
        </span>
        <strong className="rb-ktree__title">{nodeDatum.name}</strong>
        <span className="rb-ktree__meta">{metaText}</span>
      </button>
      {nodeDatum.hasChildren ? (
        <button
          type="button"
          className="rb-ktree__node-toggle"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle(nodeDatum.nodeId);
          }}
          aria-expanded={nodeDatum.isExpanded}
          aria-label={`${nodeDatum.isExpanded ? 'Collapse' : 'Expand'} branches under ${nodeDatum.name}`}
        >
          {nodeDatum.isExpanded ? <HiOutlineChevronDown size={16} /> : <HiOutlineChevronRight size={16} />}
          <span>{nodeDatum.isExpanded ? 'Collapse' : 'Expand'}</span>
        </button>
      ) : null}
    </div>
  );
}

function KnowledgeOutlineNode({ node, path, depth, expandedNodeIds, selectedNodeId, onSelect, onToggle }) {
  const nodeId = getKnowledgeNodeId(node, path);
  const children = getKnowledgeNodeChildren(node);
  const type = normalizeKnowledgeNodeType(getKnowledgeNodeType(node));
  const pageRange = node?.pageRange || {};
  const pages = pageRange.start
    ? `${pageRange.start}${pageRange.end && pageRange.end !== pageRange.start ? `–${pageRange.end}` : ''}`
    : '';
  const isExpanded = expandedNodeIds.has(nodeId);
  const active = String(selectedNodeId || '') === nodeId;

  let metaText = '';
  if (type === 'book' || type === 'document') {
    metaText = children.length === 1 ? `1 ${type === 'book' ? 'document' : 'chapter'}` : `${children.length} ${type === 'book' ? 'documents' : 'chapters'}`;
  } else if (type === 'topic') {
    const branches = children.length === 1 ? '1 branch' : `${children.length} branches`;
    metaText = pages ? `p. ${pages} · ${branches}` : branches;
  } else if (type === 'subtopic') {
    metaText = children.length === 1 ? '1 key point' : `${children.length} key points`;
  } else {
    metaText = pages ? `p. ${pages} · View details` : 'View details';
  }

  return (
    <li
      className="rb-ktree__outline-item"
      style={{ '--outline-depth': Math.min(depth, 5) }}
      role="treeitem"
      aria-expanded={children.length ? isExpanded : undefined}
    >
      <div className={`rb-ktree__outline-card rb-ktree__outline-card--${type} ${active ? 'rb-ktree__outline-card--active' : ''}`}>
        <button
          type="button"
          className="rb-ktree__outline-select"
          onClick={() => onSelect(node)}
          aria-pressed={active}
        >
          <span className="rb-ktree__outline-marker" aria-hidden="true" />
          <span className="rb-ktree__outline-copy">
            <span className="rb-ktree__outline-type">{formatKnowledgeNodeType(type)}</span>
            <strong>{node?.title || 'Untitled concept'}</strong>
            <small>{metaText}</small>
          </span>
        </button>
        {children.length ? (
          <button
            type="button"
            className="rb-ktree__outline-toggle"
            onClick={() => onToggle(nodeId)}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node?.title || 'concept'}`}
          >
            {isExpanded ? <HiOutlineChevronDown size={18} /> : <HiOutlineChevronRight size={18} />}
          </button>
        ) : null}
      </div>
      {children.length && isExpanded ? (
        <ul className="rb-ktree__outline-children" role="group">
          {children.map((child, index) => (
            <KnowledgeOutlineNode
              key={getKnowledgeNodeId(child, `${nodeId}.${index}`)}
              node={child}
              path={`${nodeId}.${index}`}
              depth={depth + 1}
              expandedNodeIds={expandedNodeIds}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function KnowledgeTreeGraph({
  rootNode,
  selectedNodeId,
  onSelectNode,
  showOnMobile = false
}) {
  const canvasRef = useRef(null);
  const isPhone = useMediaQuery('(max-width: 639px), (max-height: 500px) and (max-width: 900px)');
  const dimensions = useElementDimensions(canvasRef);
  const defaultExpandedNodeIds = useMemo(
    () => getDefaultExpandedNodeIds(rootNode, false),
    [rootNode]
  );
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => (
    getDefaultExpandedNodeIds(rootNode, false)
  ));
  const [manualZoom, setManualZoom] = useState(null);
  const [viewportReset, setViewportReset] = useState(0);

  const data = useMemo(
    () => buildVisibleKnowledgeTree(rootNode, expandedNodeIds),
    [rootNode, expandedNodeIds]
  );
  const visibleTree = data[0];
  const visibleTreeKey = useMemo(() => getVisibleTreeKey(visibleTree), [visibleTree]);
  const fitView = useMemo(
    () => calculateTreeFit(visibleTree, dimensions),
    [visibleTree, dimensions]
  );
  const zoom = manualZoom ?? fitView.zoom;

  const handleToggle = useCallback((nodeId) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setManualZoom(null);
  }, []);

  const resetToOverview = useCallback(() => {
    setExpandedNodeIds(new Set(defaultExpandedNodeIds));
    setManualZoom(null);
    setViewportReset((value) => value + 1);
  }, [defaultExpandedNodeIds]);

  const setBoundedZoom = useCallback((nextZoom) => {
    setManualZoom(Number(clampTreeZoom(nextZoom).toFixed(2)));
    setViewportReset((value) => value + 1);
  }, []);

  const renderCustomNodeElement = useCallback(({ nodeDatum }) => (
    <g>
      <foreignObject
        x={-TREE_NODE_SIZE.width / 2}
        y={-TREE_NODE_SIZE.height / 2}
        width={TREE_NODE_SIZE.width}
        height={TREE_NODE_SIZE.height}
      >
        <KnowledgeNodeCard
          nodeDatum={nodeDatum}
          active={String(selectedNodeId || '') === String(nodeDatum.nodeId)}
          onSelect={onSelectNode}
          onToggle={handleToggle}
        />
      </foreignObject>
    </g>
  ), [handleToggle, onSelectNode, selectedNodeId]);

  if (!rootNode) {
    return <div className="rb-ktree__empty">No concept map is available yet.</div>;
  }

  if (isPhone && !showOnMobile) return null;

  const mapSummary = `${fitView.stats.nodeCount} visible ${fitView.stats.nodeCount === 1 ? 'idea' : 'ideas'}`;

  return (
    <section className="rb-ktree" aria-label="Interactive book concept map">
      <header className="rb-ktree__header">
        <div className="rb-ktree__heading">
          <span>
            <strong>Knowledge Map</strong>
            <small>{isPhone ? 'Open one branch at a time' : `${mapSummary} · drag to explore`}</small>
          </span>
        </div>
        {!isPhone ? <NodeTypeLegend /> : null}
        {isPhone ? (
          <button type="button" className="rb-ktree__overview" onClick={resetToOverview}>
            <HiOutlineRefresh size={14} />
            Overview
          </button>
        ) : null}
      </header>

      {isPhone ? <NodeTypeLegend /> : null}

      {isPhone ? (
        <div className="rb-ktree__outline" role="tree" aria-label="Book concepts">
          <ul role="group">
            <KnowledgeOutlineNode
              node={rootNode}
              path="root"
              depth={0}
              expandedNodeIds={expandedNodeIds}
              selectedNodeId={selectedNodeId}
              onSelect={onSelectNode}
              onToggle={handleToggle}
            />
          </ul>
        </div>
      ) : (
        <div className="rb-ktree__canvas" ref={canvasRef}>
          {dimensions.width > 0 && dimensions.height > 0 ? (
            <Tree
              key={`${visibleTreeKey}-${viewportReset}`}
              data={data}
              dataKey={visibleTreeKey}
              dimensions={dimensions}
              orientation="horizontal"
              pathFunc="step"
              pathClassFunc={() => 'rb-ktree__link'}
              collapsible={false}
              zoomable={false}
              draggable
              hasInteractiveNodes
              zoom={zoom}
              scaleExtent={{ min: TREE_ZOOM.min, max: TREE_ZOOM.max }}
              translate={fitView.translate}
              nodeSize={{ x: TREE_NODE_SIZE.depthGap, y: TREE_NODE_SIZE.siblingGap }}
              separation={{ siblings: 1, nonSiblings: 1.12 }}
              transitionDuration={180}
              renderCustomNodeElement={renderCustomNodeElement}
            />
          ) : null}
          <div className="rb-ktree__zoom" aria-label="Concept map zoom controls">
            <button type="button" onClick={resetToOverview} aria-label="Fit concept map to screen" title="Fit">
              <HiOutlineRefresh size={15} />
              <span>Fit</span>
            </button>
            <i aria-hidden="true" />
            <button
              type="button"
              onClick={() => setBoundedZoom(zoom - TREE_ZOOM.step)}
              disabled={zoom <= TREE_ZOOM.min}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <HiOutlineZoomOut size={15} />
            </button>
            <output aria-live="polite" title="Zoom percentage">{Math.round(zoom * 100)}%</output>
            <button
              type="button"
              onClick={() => setBoundedZoom(zoom + TREE_ZOOM.step)}
              disabled={zoom >= TREE_ZOOM.max}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <HiOutlineZoomIn size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
