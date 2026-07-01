const { generateJson } = require('./groqService');

const DOCUMENT_TYPES = [
  'textbook',
  'lecture notes',
  'handwritten notes',
  'scanned pdf',
  'lecture slides',
  'research paper',
  'mixed document',
  'unknown'
];

function cleanText(text) {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clamp(text, max) {
  const value = cleanText(text);
  return value.length > max ? value.slice(0, max) : value;
}

function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function countHeadingLikeLines(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.filter((line) => {
    const short = line.length <= 80;
    const titleLike = /^[A-Z0-9][A-Z0-9\s:().,-]{4,}$/.test(line);
    const numbered = /^\d+(\.\d+)*\s+/.test(line);
    const bullets = /^[-*•]/.test(line);
    return short && (titleLike || numbered || bullets);
  }).length;
}

function samplePagesForAnalysis(pages, limit = 10) {
  if (!Array.isArray(pages) || pages.length === 0) return [];
  const first = pages.slice(0, Math.ceil(limit / 2));
  const last = pages.slice(-Math.floor(limit / 3));
  const middleSeed = pages.filter((_, idx) => idx % Math.max(1, Math.floor(pages.length / Math.max(1, limit - first.length - last.length))) === 0);
  const sampled = [...first, ...middleSeed, ...last];
  const unique = [];
  const seen = new Set();
  for (const page of sampled) {
    const key = String(page.pageNumber);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(page);
    if (unique.length >= limit) break;
  }
  return unique;
}

function buildPageContext(pages, maxChars = 18_000) {
  const parts = [];
  let used = 0;
  for (const page of pages) {
    const text = cleanText(page.text);
    if (!text) continue;
    const part = `[Page ${page.pageNumber}]\n${text}`;
    if (used + part.length > maxChars) break;
    parts.push(part);
    used += part.length;
  }
  return parts.join('\n\n');
}

function detectDocumentProfile({ pages = [], chapters = [], title = '' } = {}) {
  const textPages = pages.filter((page) => cleanText(page.text));
  const totalPages = Math.max(pages.length, 1);
  const textPageCount = textPages.length;
  const emptyRatio = 1 - (textPageCount / totalPages);
  const avgWords = textPageCount
    ? textPages.reduce((sum, page) => sum + wordCount(page.text), 0) / textPageCount
    : 0;
  const headingHits = textPages.reduce((sum, page) => sum + countHeadingLikeLines(page.text), 0);
  const headingDensity = textPageCount ? headingHits / textPageCount : 0;
  const bullets = textPages.reduce((sum, page) => {
    const lines = String(page.text || '').split(/\n+/);
    return sum + lines.filter((line) => /^[-*•]/.test(line.trim())).length;
  }, 0);

  const text = cleanText(textPages.slice(0, 8).map((p) => p.text).join(' ')).toLowerCase();
  const hasResearchSignals =
    /(abstract|keywords|introduction|methodology|methods|results|discussion|references)\b/.test(text) ||
    /doi:|arxiv|bibliography/.test(text);
  const hasSlideSignals =
    headingDensity >= 1.4 ||
    avgWords <= 90 ||
    /(agenda|objectives|overview|summary|thank you|questions? and answers?)\b/.test(text);
  const hasHandwrittenSignals =
    emptyRatio >= 0.2 && avgWords <= 120 && headingDensity < 1.2 && bullets < 8;
  const hasTextbookSignals =
    chapters.length > 1 ||
    /(exercise|review questions|chapter \d+|summary|examples|practice problems)\b/.test(text) ||
    headingDensity >= 1.1;
  const hasLectureNotesSignals =
    !hasTextbookSignals &&
    /(lecture|topic|unit|class notes|handout|tutorial|course notes)\b/.test(text);

  let type = 'unknown';
  let confidence = 0.45;
  let reason = 'insufficient evidence';

  if (emptyRatio >= 0.7) {
    type = 'scanned pdf';
    confidence = 0.88;
    reason = 'most pages have little or no extractable text';
  } else if (hasResearchSignals) {
    type = 'research paper';
    confidence = 0.82;
    reason = 'research-paper style sections were detected';
  } else if (hasSlideSignals) {
    type = 'lecture slides';
    confidence = 0.74;
    reason = 'slide-like headings and compact page text were detected';
  } else if (hasTextbookSignals) {
    type = 'textbook';
    confidence = 0.76;
    reason = 'chapter/review/exercise style signals were detected';
  } else if (hasLectureNotesSignals) {
    type = 'lecture notes';
    confidence = 0.7;
    reason = 'lecture-note wording was detected';
  } else if (hasHandwrittenSignals) {
    type = 'handwritten notes';
    confidence = 0.66;
    reason = 'sparse text with note-like structure was detected';
  } else if (textPageCount > 0 && avgWords <= 160) {
    type = 'mixed document';
    confidence = 0.55;
    reason = 'document mixes dense and sparse text';
  }

  const bookTitle = cleanText(title);
  if (!bookTitle) {
    confidence = Math.max(confidence - 0.05, 0.4);
  }

  return {
    type,
    confidence,
    reason,
    metrics: {
      totalPages,
      textPageCount,
      emptyRatio,
      avgWords,
      headingDensity
    }
  };
}

async function refineDocumentProfile({ pages = [], chapters = [], title = '', heuristic } = {}) {
  const samplePages = samplePagesForAnalysis(pages, 8);
  const sampleText = buildPageContext(samplePages, 10_000);
  if (!sampleText) return heuristic || detectDocumentProfile({ pages, chapters, title });

  try {
    const { json } = await generateJson({
      prompt: [
        `Document title: ${title || 'Untitled document'}`,
        `Heuristic guess: ${heuristic?.type || 'unknown'} (${heuristic?.confidence || 0})`,
        `Existing chapters: ${Array.isArray(chapters) ? chapters.length : 0}`,
        'Classify the document into exactly one of these types:',
        DOCUMENT_TYPES.map((item) => `- ${item}`).join('\n'),
        'Return valid JSON with this shape:',
        '{',
        '  "type": "one of the allowed types",',
        '  "confidence": 0.0,',
        '  "reason": "short explanation",',
        '  "hasChapterStructure": true,',
        '  "hasSemanticSections": true',
        '}',
        'Use only the provided document text.',
        'Document text:',
        sampleText
      ].join('\n\n'),
      systemInstruction: 'You classify educational PDFs for a reading app. Be conservative and do not invent structure that is not supported by the text.',
      temperature: 0.1
    });

    const type = DOCUMENT_TYPES.includes(String(json.type || '').toLowerCase())
      ? String(json.type || '').toLowerCase()
      : heuristic?.type || 'unknown';
    const confidence = Number.isFinite(Number(json.confidence)) ? Number(json.confidence) : (heuristic?.confidence || 0.5);
    return {
      type,
      confidence,
      reason: cleanText(json.reason || heuristic?.reason || 'classified from document text'),
      hasChapterStructure: Boolean(json.hasChapterStructure),
      hasSemanticSections: Boolean(json.hasSemanticSections),
      metrics: heuristic?.metrics || {}
    };
  } catch (_) {
    return heuristic || detectDocumentProfile({ pages, chapters, title });
  }
}

function normalizePageRange(range, pages) {
  const pageNumbers = pages
    .map((page) => Number(page.pageNumber))
    .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0);
  const min = pageNumbers.length ? Math.min(...pageNumbers) : 1;
  const max = pageNumbers.length ? Math.max(...pageNumbers) : min;
  const start = Math.max(1, safeInt(range?.start, min));
  const end = Math.max(start, safeInt(range?.end, max));
  return { start, end };
}

function overlapPageRange(nodeRange, chunkRange) {
  return chunkRange.pageEnd >= nodeRange.start && chunkRange.pageStart <= nodeRange.end;
}

function assignChunkIds(node, chunks) {
  const nodeRange = normalizePageRange(node.pageRange, []);
  const nodeChunks = chunks.filter((chunk) => overlapPageRange(nodeRange, chunk));
  const children = Array.isArray(node.children) ? node.children : [];
  return {
    ...node,
    chunkIds: nodeChunks.map((chunk) => chunk._id),
    children: children.map((child) => assignChunkIds(child, chunks))
  };
}

function flattenNodes(node, bucket = []) {
  if (!node) return bucket;
  bucket.push({
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    title: node.title,
    parentId: node.parentId || '',
    pageRange: node.pageRange,
    summary: node.summary,
    detailedNotes: node.detailedNotes,
    keyPoints: node.keyPoints || [],
    definitions: node.definitions || [],
    examples: node.examples || [],
    quizQuestions: node.quizQuestions || [],
    chunkIds: node.chunkIds || []
  });
  for (const child of node.children || []) {
    flattenNodes(child, bucket);
  }
  return bucket;
}

function normalizeQuizQuestions(quizQuestions) {
  if (!Array.isArray(quizQuestions)) return [];
  return quizQuestions.slice(0, 5).map((item) => ({
    question: cleanText(item.question || ''),
    options: Array.isArray(item.options) ? item.options.map((opt) => cleanText(opt)).filter(Boolean).slice(0, 4) : [],
    answer: cleanText(item.answer || ''),
    explanation: cleanText(item.explanation || '')
  }));
}

function normalizeNodeList(nodes, { rootId, parentId = '', prefix = 'node', nodeType = 'topic' } = {}) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter(Boolean)
    .map((node, idx) => {
      const safeIdx = idx + 1;
      const nodeId = cleanText(node.nodeId || node.topicId || node.chapterId || `${rootId}-${prefix}-${safeIdx}`) || `${rootId}-${prefix}-${safeIdx}`;
      const title = cleanText(node.title || `${nodeType} ${safeIdx}`);
      const children = Array.isArray(node.subtopics) ? node.subtopics : (Array.isArray(node.children) ? node.children : []);
      return {
        nodeId,
        topicId: node.topicId || nodeId,
        chapterId: node.chapterId || nodeId,
        nodeType: cleanText(node.nodeType || nodeType) || nodeType,
        title,
        order: Number.isFinite(Number(node.order)) ? Number(node.order) : idx,
        pageRange: normalizePageRange(node.pageRange || { start: node.pageStart, end: node.pageEnd }, []),
        summary: cleanText(node.summary || ''),
        detailedNotes: cleanText(node.detailedNotes || ''),
        keyPoints: Array.isArray(node.keyPoints) ? node.keyPoints.map((item) => cleanText(item)).filter(Boolean) : [],
        definitions: Array.isArray(node.definitions) ? node.definitions.map((item) => cleanText(item)).filter(Boolean) : [],
        examples: Array.isArray(node.examples) ? node.examples.map((item) => cleanText(item)).filter(Boolean) : [],
        quizQuestions: normalizeQuizQuestions(node.quizQuestions),
        children: normalizeNodeList(children, {
          rootId: nodeId,
          parentId: nodeId,
          prefix: 'sub',
          nodeType: 'subtopic'
        }),
        parentId
      };
    });
}

function buildLegacyChapterEntry(rootNode, chapter, idx) {
  return {
    nodeId: rootNode.nodeId,
    nodeType: rootNode.nodeType || 'chapter',
    chapterId: String(chapter._id),
    title: rootNode.title || chapter.title,
    order: Number.isFinite(Number(chapter.order)) ? Number(chapter.order) : idx,
    pageRange: rootNode.pageRange,
    summary: rootNode.summary || '',
    detailedNotes: rootNode.detailedNotes || '',
    keyPoints: rootNode.keyPoints || [],
    definitions: rootNode.definitions || [],
    examples: rootNode.examples || [],
    quizQuestions: rootNode.quizQuestions || [],
    topics: (rootNode.children || []).map((topic, topicIdx) => ({
      nodeId: topic.nodeId,
      nodeType: topic.nodeType || 'topic',
      topicId: topic.topicId || topic.nodeId,
      title: topic.title,
      order: topicIdx,
      pageRange: topic.pageRange,
      summary: topic.summary || '',
      detailedNotes: topic.detailedNotes || '',
      keyPoints: topic.keyPoints || [],
      definitions: topic.definitions || [],
      examples: topic.examples || [],
      quizQuestions: topic.quizQuestions || [],
      subtopics: (topic.children || []).map((subtopic, subIdx) => ({
        nodeId: subtopic.nodeId,
        nodeType: subtopic.nodeType || 'subtopic',
        topicId: subtopic.topicId || subtopic.nodeId,
        title: subtopic.title,
        order: subIdx,
        pageRange: subtopic.pageRange,
        summary: subtopic.summary || '',
        detailedNotes: subtopic.detailedNotes || '',
        keyPoints: subtopic.keyPoints || [],
        definitions: subtopic.definitions || [],
        examples: subtopic.examples || [],
        quizQuestions: subtopic.quizQuestions || []
      }))
    }))
  };
}

async function buildKnowledgeTree({ book, chapter, pages, chunks, documentType, mode = 'chapter' }) {
  const sampleText = clamp(buildPageContext(samplePagesForAnalysis(pages, 10), mode === 'semantic' ? 12_000 : 16_000), mode === 'semantic' ? 12_000 : 16_000);
  const rootId = mode === 'semantic' ? `document-${chapter._id}` : `chapter-${chapter._id}`;
  const rootTitle = mode === 'semantic' ? cleanText(book.title || chapter.title || 'Document') : cleanText(chapter.title || book.title || 'Chapter');
  const systemInstruction = mode === 'semantic'
    ? 'You are a document-understanding engine for an EdTech reading app. Generate a compact semantic knowledge tree from the supplied PDF text. Use only the text provided. Do not invent chapters if the document does not clearly have them.'
    : 'You are a curriculum designer for an EdTech reading app. Generate a chapter knowledge tree from the supplied PDF text. Use only the text provided. Do not invent content that is not present.';

  const prompt = mode === 'semantic'
    ? [
        `Document type: ${documentType}`,
        `Document title: ${book.title}`,
        'Return valid JSON in this exact shape:',
        '{',
        '  "summary": "string",',
        '  "keyPoints": ["string"],',
        '  "definitions": ["string"],',
        '  "examples": ["string"],',
        '  "nodes": [',
        '    {',
        '      "title": "string",',
        '      "summary": "string",',
        '      "detailedNotes": "string",',
        '      "pageRange": { "start": 1, "end": 1 },',
        '      "keyPoints": ["string"],',
        '      "definitions": ["string"],',
        '      "examples": ["string"],',
        '      "quizQuestions": [',
        '        { "question": "string", "options": ["string"], "answer": "string", "explanation": "string" }',
        '      ],',
        '      "subtopics": [',
        '        {',
        '          "title": "string",',
        '          "summary": "string",',
        '          "detailedNotes": "string",',
        '          "pageRange": { "start": 1, "end": 1 },',
        '          "keyPoints": ["string"],',
        '          "definitions": ["string"],',
        '          "examples": ["string"],',
        '          "quizQuestions": []',
        '        }',
        '      ]',
        '    }',
        '  ]',
        '}',
        'Use 3 to 7 top-level semantic nodes.',
        'Document text:',
        sampleText
      ].join('\n\n')
    : [
        `Document type: ${documentType}`,
        `Chapter title: ${chapter.title}`,
        'Return valid JSON in this exact shape:',
        '{',
        '  "summary": "string",',
        '  "keyPoints": ["string"],',
        '  "definitions": ["string"],',
        '  "examples": ["string"],',
        '  "nodes": [',
        '    {',
        '      "title": "string",',
        '      "summary": "string",',
        '      "detailedNotes": "string",',
        '      "pageRange": { "start": 1, "end": 1 },',
        '      "keyPoints": ["string"],',
        '      "definitions": ["string"],',
        '      "examples": ["string"],',
        '      "quizQuestions": [',
        '        { "question": "string", "options": ["string"], "answer": "string", "explanation": "string" }',
        '      ],',
        '      "subtopics": [',
        '        {',
        '          "title": "string",',
        '          "summary": "string",',
        '          "detailedNotes": "string",',
        '          "pageRange": { "start": 1, "end": 1 },',
        '          "keyPoints": ["string"],',
        '          "definitions": ["string"],',
        '          "examples": ["string"],',
        '          "quizQuestions": []',
        '        }',
        '      ]',
        '    }',
        '  ]',
        '}',
        'Use 3 to 6 topic nodes and 1 to 3 subtopics per topic when useful.',
        'Chapter text:',
        sampleText
      ].join('\n\n');

  const { json } = await generateJson({
    prompt,
    systemInstruction,
    temperature: 0.2
  });

  const nodes = normalizeNodeList(json.nodes || [], { rootId, parentId: rootId, prefix: mode === 'semantic' ? 'topic' : 'topic', nodeType: mode === 'semantic' ? 'topic' : 'topic' });
  const rootNode = {
    nodeId: rootId,
    nodeType: mode === 'semantic' ? 'document' : 'chapter',
    title: rootTitle,
    pageRange: normalizePageRange({ start: pages[0]?.pageNumber, end: pages[pages.length - 1]?.pageNumber }, pages),
    summary: cleanText(json.summary || ''),
    detailedNotes: cleanText(json.summary || ''),
    keyPoints: Array.isArray(json.keyPoints) ? json.keyPoints.map((item) => cleanText(item)).filter(Boolean) : [],
    definitions: Array.isArray(json.definitions) ? json.definitions.map((item) => cleanText(item)).filter(Boolean) : [],
    examples: Array.isArray(json.examples) ? json.examples.map((item) => cleanText(item)).filter(Boolean) : [],
    quizQuestions: [],
    children: nodes
  };

  const assigned = assignChunkIds(rootNode, chunks);
  const flatNodes = flattenNodes(assigned);
  return {
    treeNode: assigned,
    flatNodes,
    legacyChapter: buildLegacyChapterEntry(assigned, chapter, Number(chapter.order) || 0)
  };
}

function findNodeById(node, nodeId) {
  if (!node || !nodeId) return null;
  if (String(node.nodeId) === String(nodeId) || String(node.topicId) === String(nodeId) || String(node.chapterId) === String(nodeId)) {
    return node;
  }
  for (const child of node.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

function collectTreeNodes(tree) {
  const nodes = [];
  for (const child of tree?.children || []) {
    flattenNodes(child, nodes);
  }
  return nodes;
}

module.exports = {
  DOCUMENT_TYPES,
  cleanText,
  detectDocumentProfile,
  refineDocumentProfile,
  buildKnowledgeTree,
  findNodeById,
  collectTreeNodes
};
