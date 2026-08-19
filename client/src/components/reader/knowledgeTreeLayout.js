export const TREE_ZOOM = {
  min: 0.24,
  max: 1.6,
  step: 0.14
};

export const TREE_NODE_SIZE = {
  width: 252,
  height: 124,
  depthGap: 348,
  siblingGap: 152
};

export function getKnowledgeNodeChildren(node) {
  return node?.children || node?.subtopics || node?.topics || [];
}

export function getKnowledgeNodeId(node, fallback = '') {
  return String(
    node?.nodeId
    || node?.topicId
    || node?.chapterId
    || fallback
    || node?.title
    || ''
  );
}

export function getKnowledgeNodeType(node) {
  return String(node?.nodeType || (node?.chapterId ? 'chapter' : 'topic')).toLowerCase();
}

export function formatKnowledgeNodeType(type) {
  const normalized = String(type || 'topic').toLowerCase();
  if (normalized === 'book' || normalized === 'document') return normalized;
  if (normalized === 'point') return 'key point';
  return normalized.replace(/[-_]+/g, ' ');
}

export function normalizeKnowledgeNodeType(type) {
  return String(type || 'topic').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function resolveNodeId(node, path) {
  return getKnowledgeNodeId(node, path);
}

export function getDefaultExpandedNodeIds(rootNode, revealTopics = false) {
  if (!rootNode) return new Set();

  const rootId = resolveNodeId(rootNode, 'root');
  const expanded = new Set([rootId]);
  if (revealTopics) {
    getKnowledgeNodeChildren(rootNode).forEach((child, index) => {
      expanded.add(resolveNodeId(child, `${rootId}.${index}`));
    });
  }
  return expanded;
}

function toGraphNode(node, expandedNodeIds, depth = 0, index = 0, path = 'root') {
  const nodeId = resolveNodeId(node, path);
  const sourceChildren = getKnowledgeNodeChildren(node);
  const isExpanded = expandedNodeIds.has(nodeId);
  const children = isExpanded
    ? sourceChildren.map((child, childIndex) => (
        toGraphNode(child, expandedNodeIds, depth + 1, childIndex, `${nodeId}.${childIndex}`)
      ))
    : [];
  const pageRange = node?.pageRange || {};

  return {
    name: node?.title || (depth === 0 ? 'Whole book' : 'Untitled concept'),
    nodeId,
    nodeType: getKnowledgeNodeType(node),
    title: node?.title || '',
    pageRange,
    summary: node?.summary || '',
    detailedNotes: node?.detailedNotes || '',
    keyPoints: node?.keyPoints || [],
    definitions: node?.definitions || [],
    examples: node?.examples || [],
    quizQuestions: node?.quizQuestions || [],
    depth,
    siblingIndex: index,
    hasChildren: sourceChildren.length > 0,
    childCount: sourceChildren.length,
    isExpanded,
    attributes: {
      type: getKnowledgeNodeType(node),
      pages: pageRange.start
        ? `${pageRange.start}${pageRange.end && pageRange.end !== pageRange.start ? `–${pageRange.end}` : ''}`
        : ''
    },
    children: children.length > 0 ? children : undefined
  };
}

export function buildVisibleKnowledgeTree(rootNode, expandedNodeIds = new Set()) {
  if (!rootNode) return [];
  return [toGraphNode(rootNode, expandedNodeIds)];
}

export function getVisibleTreeStats(node, depth = 0) {
  if (!node) return { maxDepth: 0, leafCount: 1, nodeCount: 0 };
  const children = node.children || [];
  if (!children.length) {
    return { maxDepth: depth, leafCount: 1, nodeCount: 1 };
  }

  return children.reduce((stats, child) => {
    const childStats = getVisibleTreeStats(child, depth + 1);
    return {
      maxDepth: Math.max(stats.maxDepth, childStats.maxDepth),
      leafCount: stats.leafCount + childStats.leafCount,
      nodeCount: stats.nodeCount + childStats.nodeCount
    };
  }, { maxDepth: depth, leafCount: 0, nodeCount: 1 });
}

export function clampTreeZoom(value) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 1;
  return Math.min(TREE_ZOOM.max, Math.max(TREE_ZOOM.min, safeValue));
}

export function calculateTreeFit(rootNode, dimensions, nodeSize = TREE_NODE_SIZE) {
  const width = Math.max(1, Number(dimensions?.width) || 1);
  const height = Math.max(1, Number(dimensions?.height) || 1);
  const stats = getVisibleTreeStats(rootNode);
  const horizontalPadding = Math.min(56, Math.max(28, width * 0.07));
  const verticalPadding = Math.min(52, Math.max(28, height * 0.08));
  const naturalWidth = nodeSize.width + (stats.maxDepth * nodeSize.depthGap);
  const naturalHeight = nodeSize.height
    + (Math.max(0, stats.leafCount - 1) * nodeSize.siblingGap * 1.12);
  const widthScale = (width - (horizontalPadding * 2)) / naturalWidth;
  const heightScale = (height - (verticalPadding * 2)) / naturalHeight;
  const zoom = clampTreeZoom(Math.min(0.94, widthScale, heightScale));

  return {
    zoom: Number(zoom.toFixed(2)),
    translate: {
      x: Number((horizontalPadding + ((nodeSize.width / 2) * zoom)).toFixed(2)),
      y: Number((height / 2).toFixed(2))
    },
    stats
  };
}

export function getVisibleTreeKey(node) {
  if (!node) return 'empty';
  const childKey = (node.children || []).map(getVisibleTreeKey).join(',');
  return `${node.nodeId}[${childKey}]`;
}
