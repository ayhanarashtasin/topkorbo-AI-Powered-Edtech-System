const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { bucket } = require('../config/firebase');
const Book = require('../models/Book');
const BookKnowledge = require('../models/BookKnowledge');
const BookChunk = require('../models/BookChunk');
const BookPage = require('../models/BookPage');
const { extractPdfPages, chunkTextByPages } = require('./pdfService');
const { generateJson, generateText } = require('./groqService');
const { embedText } = require('./embeddingService');
const {
  detectDocumentProfile,
  refineDocumentProfile,
  buildKnowledgeTree,
  findNodeById,
  collectTreeNodes,
  cleanText: cleanDocText
} = require('./documentUnderstandingService');

const MAX_CHAPTER_CONTEXT_CHARS = 12_000;
const MAX_TOPIC_CONTEXT_CHARS = 10_000;
const MAX_PAGE_RETRIEVED_CHUNKS = 4;
const MAX_CHAPTER_RETRIEVED_CHUNKS = 5;
const MAX_BOOK_RETRIEVED_CHUNKS = 6;
const CHUNK_BATCH_SIZE = 4;
const VECTOR_INDEX_NAME = process.env.MONGODB_VECTOR_INDEX || process.env.ATLAS_VECTOR_INDEX || 'book_chunk_vector_index';
const ENABLE_KNOWLEDGE_TREE = String(process.env.ENABLE_KNOWLEDGE_TREE || '').toLowerCase() === 'true';

const queue = [];
let running = false;
const inFlight = new Set();

function storagePathFromUrl(fileUrl) {
  if (!fileUrl) return '';

  const storagePrefix = `https://storage.googleapis.com/${bucket.name}/`;
  const fbPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;
  const gsPrefix = `gs://${bucket.name}/`;

  if (fileUrl.startsWith(storagePrefix)) {
    return fileUrl.slice(storagePrefix.length);
  }
  if (fileUrl.startsWith(fbPrefix)) {
    return decodeURIComponent(fileUrl.slice(fbPrefix.length).split('?')[0]);
  }
  if (fileUrl.startsWith(gsPrefix)) {
    return fileUrl.slice(gsPrefix.length);
  }
  return '';
}

async function loadFileBuffer(fileUrl) {
  if (!fileUrl) {
    throw new Error('Missing file URL');
  }

  if (fileUrl.startsWith('/uploads/')) {
    const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
    const relativePath = fileUrl.replace(/^\/uploads\//, '');
    const filePath = path.resolve(uploadsRoot, relativePath);
    if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) {
      throw new Error('Local PDF file not found');
    }
    return fs.readFileSync(filePath);
  }

  const storagePath = storagePathFromUrl(fileUrl);
  if (!storagePath) {
    throw new Error('Unsupported file URL');
  }

  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('PDF file not found in Firebase Storage');
  }
  const [buffer] = await file.download();
  return buffer;
}

function cleanText(text) {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChunkText(text) {
  return cleanText(text).toLowerCase().replace(/\s+/g, ' ');
}

function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function normalizeStatus(status) {
  if (!status) return 'not_started';
  if (status === 'pending') return 'not_started';
  return status;
}

function uniqueSortedPages(chunks = []) {
  return Array.from(new Set(
    chunks.flatMap((chunk) => {
      if (Array.isArray(chunk.pageNumbers) && chunk.pageNumbers.length) return chunk.pageNumbers;
      const start = Number(chunk.pageStart);
      const end = Number(chunk.pageEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
      const pages = [];
      for (let page = start; page <= end; page += 1) pages.push(page);
      return pages;
    }).filter((page) => Number.isFinite(page) && page > 0)
  )).sort((a, b) => a - b);
}

function formatSourceList(chunks = []) {
  const pages = uniqueSortedPages(chunks);
  if (!pages.length) return [];
  return pages.map((pageNumber) => ({ pageNumber, label: `Page ${pageNumber}` }));
}

function dedupeChunksByText(chunks = []) {
  const seen = new Set();
  const deduped = [];
  for (const chunk of chunks) {
    const key = `${Number(chunk.pageStart || chunk.pageNumber || 0)}:${normalizeChunkText(chunk.text || '').slice(0, 240)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(chunk);
  }
  return deduped;
}

function sortChunksByPageAndIndex(chunks = []) {
  return [...chunks].sort((a, b) => {
    const aPage = Number(a.pageStart || a.pageNumbers?.[0] || a.pageNumber || 0);
    const bPage = Number(b.pageStart || b.pageNumbers?.[0] || b.pageNumber || 0);
    if (aPage !== bPage) return aPage - bPage;
    return Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0);
  });
}

function stripTrailingSources(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const idx = raw.search(/\n\s*sources\s*:/i);
  return idx === -1 ? raw : raw.slice(0, idx).trim();
}

function splitTextIntoChunks(text, pageNumber, { chunkSizeWords = 650, overlapWords = 100 } = {}) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    const chunkWords = words.slice(start, end);
    const chunkText = chunkWords.join(' ').trim();
    if (chunkText) {
      chunkIndex += 1;
      const normalizedPage = Number(pageNumber) || 1;
      chunks.push({
        chunkIndex,
        pageStart: normalizedPage,
        pageEnd: normalizedPage,
        pageNumbers: [normalizedPage],
        text: chunkText
      });
    }
    if (end >= words.length) break;
    const nextStart = Math.max(end - overlapWords, start + 1);
    start = nextStart;
  }

  return chunks;
}

async function upsertPageRecords({ bookId, chapterId, pages }) {
  const ops = [];
  for (const page of pages || []) {
    const extractedText = cleanText(page.text || '');
    const processingStatus = page.status || (extractedText ? 'completed' : 'empty');
    ops.push({
      updateOne: {
        filter: {
          bookId,
          chapterId: chapterId || null,
          pageNumber: Number(page.pageNumber)
        },
        update: {
          $set: {
            bookId,
            chapterId: chapterId || null,
            pageNumber: Number(page.pageNumber),
            extractedText,
            processingStatus,
            wordCount: wordCount(extractedText),
            extractionMethod: page.extractionMethod || 'pdf-parse',
            errorMessage: page.errorMessage || ''
          }
        },
        upsert: true
      }
    });
  }
  if (ops.length > 0) {
    await BookPage.bulkWrite(ops, { ordered: false });
  }
}

function chunkWordCount(chunkText) {
  return cleanText(chunkText).split(/\s+/).filter(Boolean).length;
}

function clamp(text, max) {
  const clean = cleanText(text);
  return clean.length > max ? clean.slice(0, max) : clean;
}

function joinPages(pages, maxChars = MAX_CHAPTER_CONTEXT_CHARS) {
  const parts = [];
  let used = 0;
  for (const page of pages) {
    if (!page || !page.text) continue;
    const segment = `[Page ${page.pageNumber}]\n${cleanText(page.text)}`;
    if (used + segment.length > maxChars) break;
    parts.push(segment);
    used += segment.length;
  }
  return parts.join('\n\n');
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenSet(text) {
  return new Set(
    cleanText(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 2)
  );
}

function lexicalScore(queryTokens, text) {
  if (!queryTokens.size) return 0;
  const textTokens = tokenSet(text);
  if (!textTokens.size) return 0;
  let shared = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) shared += 1;
  }
  return shared / Math.max(queryTokens.size, 1);
}

function normalizeTopic(topic, fallbackOrder = 0) {
  return {
    topicId: topic.topicId || `topic-${fallbackOrder + 1}`,
    title: cleanText(topic.title || `Topic ${fallbackOrder + 1}`),
    order: Number.isFinite(Number(topic.order)) ? Number(topic.order) : fallbackOrder,
    pageRange: {
      start: Math.max(1, Number(topic.pageRange?.start || topic.pageStart || 1)),
      end: Math.max(1, Number(topic.pageRange?.end || topic.pageEnd || 1))
    },
    summary: cleanText(topic.summary || ''),
    detailedNotes: cleanText(topic.detailedNotes || ''),
    keyPoints: Array.isArray(topic.keyPoints) ? topic.keyPoints.map((item) => cleanText(item)).filter(Boolean) : [],
    definitions: Array.isArray(topic.definitions) ? topic.definitions.map((item) => cleanText(item)).filter(Boolean) : [],
    examples: Array.isArray(topic.examples) ? topic.examples.map((item) => cleanText(item)).filter(Boolean) : [],
    quizQuestions: Array.isArray(topic.quizQuestions)
      ? topic.quizQuestions.slice(0, 5).map((q) => ({
          question: cleanText(q.question || ''),
          options: Array.isArray(q.options) ? q.options.map((o) => cleanText(o)).filter(Boolean).slice(0, 4) : [],
          answer: cleanText(q.answer || ''),
          explanation: cleanText(q.explanation || '')
        }))
      : []
  };
}

async function processChapterDocument({ book, chapter, knowledgeDoc }) {
  const buffer = await loadFileBuffer(chapter.fileUrl);
  const pages = await extractPdfPages(buffer);
  const normalizedPages = pages.map((page) => ({
    ...page,
    status: page.status || (cleanText(page.text) ? 'completed' : 'empty'),
    extractionMethod: page.extractionMethod || 'pdf-parse',
    errorMessage: page.errorMessage || ''
  }));
  const extractedPages = normalizedPages.filter((page) => cleanText(page.text));
  const emptyPages = normalizedPages.filter((page) => !cleanText(page.text)).length;

  await upsertPageRecords({
    bookId: book._id,
    chapterId: chapter._id,
    pages: normalizedPages
  });

  knowledgeDoc.status = 'chunking';
  knowledgeDoc.message = `Chunking ${chapter.title}`;
  knowledgeDoc.totalPages += normalizedPages.length;
  knowledgeDoc.extractedPages += extractedPages.length;
  knowledgeDoc.emptyPages += emptyPages;
  knowledgeDoc.updatedAt = new Date();
  await knowledgeDoc.save();

  const chunks = chunkTextByPages(normalizedPages, { chunkSizeWords: 650, overlapWords: 100 });
  const storedChunks = [];
  knowledgeDoc.status = 'embedding';
  knowledgeDoc.message = `Embedding ${chapter.title}`;
  knowledgeDoc.updatedAt = new Date();
  await knowledgeDoc.save();

  const CHUNK_BATCH = 4;
  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    const batch = chunks.slice(i, i + CHUNK_BATCH);
    const batchResults = await Promise.all(
      batch.map(async (chunk, batchOffset) => {
        const text = cleanText(chunk.text || '');
        if (!text) return null;
        try {
          const embedding = await embedText(text, {
            title: `${book.title} - ${chapter.title} - Pages ${chunk.pageStart}-${chunk.pageEnd}`
          });
          return {
            bookId: book._id,
            chapterId: chapter._id,
            pageNumbers: Array.isArray(chunk.pageNumbers) ? chunk.pageNumbers : [chunk.pageStart, chunk.pageEnd].filter(Boolean),
            pageStart: Number(chunk.pageStart) || 1,
            pageEnd: Number(chunk.pageEnd) || Number(chunk.pageStart) || 1,
            chunkIndex: Number(chunk.chunkIndex) || (i + batchOffset + 1),
            text,
            embedding,
            tokenCount: chunkWordCount(text)
          };
        } catch (chunkErr) {
          return null;
        }
      })
    );

    const validDocs = batchResults.filter(Boolean);
    storedChunks.push(...validDocs);
    knowledgeDoc.totalChunks += validDocs.length;
    knowledgeDoc.embeddedChunks += validDocs.length;
  }

  if (storedChunks.length) {
    await BookChunk.insertMany(storedChunks);
  }

  const isKnowledgeTreeEnabled = String(process.env.ENABLE_KNOWLEDGE_TREE || '').toLowerCase() === 'true';
  if (isKnowledgeTreeEnabled) {
    try {
      const chapterProfile = detectDocumentProfile({ pages: normalizedPages, chapters: book.chapters || [], title: chapter.title });
      const refinedProfile = await refineDocumentProfile({
        pages: normalizedPages,
        chapters: book.chapters || [],
        title: chapter.title,
        heuristic: chapterProfile
      });
      const treeMode = (book.chapters || []).length > 1 || refinedProfile.type === 'textbook' ? 'chapter' : 'semantic';
      const treeResult = await buildKnowledgeTree({
        book,
        chapter,
        pages: normalizedPages,
        chunks: storedChunks,
        documentType: refinedProfile.type || chapterProfile.type || 'unknown',
        mode: treeMode
      });
      knowledgeDoc.tree = knowledgeDoc.tree || {
        nodeId: `book-${book._id}`,
        nodeType: 'book',
        title: book.title,
        documentType: refinedProfile.type || chapterProfile.type || 'unknown',
        children: []
      };
      knowledgeDoc.tree.children = knowledgeDoc.tree.children || [];
      knowledgeDoc.tree.children.push(treeResult.treeNode);
      knowledgeDoc.nodes = (knowledgeDoc.nodes || []).concat(treeResult.flatNodes);
      knowledgeDoc.chapters = (knowledgeDoc.chapters || []).concat(treeResult.legacyChapter);
      knowledgeDoc.bookSummary = cleanDocText([knowledgeDoc.bookSummary, treeResult.treeNode.summary || ''].filter(Boolean).join(' '));
      knowledgeDoc.bookKeyPoints = Array.from(new Set([...(knowledgeDoc.bookKeyPoints || []), ...(treeResult.treeNode.keyPoints || [])])).slice(0, 12);
      knowledgeDoc.documentType = refinedProfile.type || chapterProfile.type || knowledgeDoc.documentType || 'unknown';
      knowledgeDoc.markModified('tree');
    } catch (treeErr) {
      console.error('[bookRagService] Tree generation error:', treeErr.message);
      knowledgeDoc.lastProcessingError = cleanText(treeErr?.message || 'Tree generation failed');
    }
  }

  knowledgeDoc.sourcePages += normalizedPages.length;
  knowledgeDoc.vectorIndexStatus = 'ready';
  knowledgeDoc.message = `Processed ${chapter.title}`;
  knowledgeDoc.updatedAt = new Date();
  await knowledgeDoc.save();
  return { pages: normalizedPages, chunks: storedChunks };
}

async function processBookKnowledge(bookId) {
  const lockKey = String(bookId);
  if (inFlight.has(lockKey)) return null;
  inFlight.add(lockKey);

  try {
    const book = await Book.findById(bookId).lean();
    if (!book) {
      throw new Error('Book not found');
    }

    const knowledge = await BookKnowledge.findOneAndUpdate(
      { bookId: book._id },
      {
        $set: {
          status: 'extracting_text',
          message: 'Extracting text from uploaded PDFs',
          startedAt: new Date(),
          failedAt: null,
          lastProcessingError: '',
          vectorIndexStatus: 'not_started'
        },
        $setOnInsert: {
          bookId: book._id,
          version: 1,
          chapters: [],
          bookSummary: '',
          bookKeyPoints: [],
          totalPages: 0,
          extractedPages: 0,
          emptyPages: 0,
          totalChunks: 0,
          embeddedChunks: 0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await BookChunk.deleteMany({ bookId: book._id });
    await BookPage.deleteMany({ bookId: book._id });
    knowledge.chapters = [];
    knowledge.bookSummary = '';
    knowledge.bookKeyPoints = [];
    knowledge.documentType = 'unknown';
    knowledge.tree = ENABLE_KNOWLEDGE_TREE ? {
      nodeId: `book-${book._id}`,
      nodeType: 'book',
      title: book.title,
      documentType: 'unknown',
      children: []
    } : null;
    knowledge.nodes = [];
    knowledge.sourcePages = 0;
    knowledge.totalPages = 0;
    knowledge.extractedPages = 0;
    knowledge.emptyPages = 0;
    knowledge.totalChunks = 0;
    knowledge.embeddedChunks = 0;
    knowledge.vectorIndexStatus = 'not_started';
    knowledge.lastProcessingError = '';
    await knowledge.save();

    const chapters = [...(book.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (chapters.length === 0) {
      throw new Error('No chapter PDFs found for this book');
    }
    for (const chapter of chapters) {
      knowledge.status = 'extracting_text';
      knowledge.message = `Extracting text from ${chapter.title}`;
      knowledge.updatedAt = new Date();
      await knowledge.save();

      const result = await processChapterDocument({
        book,
        chapter,
        knowledgeDoc: knowledge
      });
      const failedPage = result.pages.find((page) => page.status === 'failed');
      if (failedPage?.errorMessage) {
        knowledge.lastProcessingError = failedPage.errorMessage;
      }
      knowledge.status = 'indexing';
      knowledge.message = `Indexed ${chapter.title}`;
      knowledge.updatedAt = new Date();
      await knowledge.save();
    }

    knowledge.status = 'completed';
    knowledge.message = 'Knowledge base ready';
    knowledge.vectorIndexStatus = 'ready';
    knowledge.tree = knowledge.tree || (ENABLE_KNOWLEDGE_TREE ? {
      nodeId: `book-${book._id}`,
      nodeType: 'book',
      title: book.title,
      documentType: knowledge.documentType || 'unknown',
      children: []
    } : null);
    if (knowledge.tree) {
      knowledge.tree.documentType = knowledge.documentType || knowledge.tree.documentType || 'unknown';
      knowledge.markModified('tree');
    }
    knowledge.completedAt = new Date();
    knowledge.updatedAt = new Date();
    await knowledge.save();
    return knowledge;
  } catch (err) {
    await BookKnowledge.findOneAndUpdate(
      { bookId },
      {
        $set: {
          status: 'failed',
          message: err.message || 'Failed to process book',
          lastProcessingError: err.message || 'Failed to process book',
          vectorIndexStatus: 'failed',
          failedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    ).catch(() => {});
    throw err;
  } finally {
    inFlight.delete(lockKey);
  }
}

async function queueBookKnowledge(bookId, { force = false } = {}) {
  const id = String(bookId);
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const existing = await BookKnowledge.findOne({ bookId: id }).lean().catch(() => null);
  const activeStatuses = new Set(['extracting_text', 'chunking', 'embedding', 'indexing']);
  const isCurrentlyInFlight = inFlight.has(id) || queue.some((item) => item.id === id);

  if (!force && isCurrentlyInFlight && activeStatuses.has(normalizeStatus(existing?.status))) {
    return existing;
  }

  if (!queue.find((item) => item.id === id)) {
    queue.push({ id, force });
  }
  if (!running) {
    void drainQueue();
  }
  return existing || null;
}

async function drainQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) continue;
      try {
        await processBookKnowledge(job.id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[bookRagService] processing failed:', err.message);
      }
    }
  } finally {
    running = false;
  }
}

async function getOrCreateBookKnowledge(bookId) {
  const knowledge = await BookKnowledge.findOne({ bookId }).lean();
  if (knowledge) return knowledge;
  await queueBookKnowledge(bookId);
  return {
    bookId,
    status: 'not_started',
    message: 'Processing has been queued',
    chapters: []
  };
}

async function retrieveRelevantChunks({ bookId, chapterId, topicId, nodeId, pageNumber, question, scope = 'book' }) {
  const resolvedBookId = mongoose.Types.ObjectId.isValid(bookId)
    ? new mongoose.Types.ObjectId(bookId)
    : bookId;
  const numericPage = Number(pageNumber);
  const requestedPage = Number.isFinite(numericPage) && numericPage > 0 ? numericPage : null;
  const strictPageMode = scope === 'page' && requestedPage;
  const knowledge = await BookKnowledge.findOne({ bookId: resolvedBookId }).lean().catch(() => null);
  const chapterNode = knowledge?.tree?.children?.find((item) => String(item.chapterId) === String(chapterId))
    || knowledge?.chapters?.find((item) => String(item.chapterId) === String(chapterId))
    || null;
  const selectedTopicId = scope === 'node' ? nodeId : topicId;
  const topicNode = selectedTopicId
    ? findNodeById(chapterNode, selectedTopicId)
      || chapterNode?.topics?.find((item) => String(item.topicId) === String(selectedTopicId))
      || null
    : null;
  const selectedRange = topicNode?.pageRange || chapterNode?.pageRange || null;

  const queryTokens = tokenSet(question || '');

  if (strictPageMode) {
    const pageFilter = {
      bookId: resolvedBookId,
      pageNumber: requestedPage
    };
    if (chapterId) {
      pageFilter.chapterId = mongoose.Types.ObjectId.isValid(chapterId)
        ? new mongoose.Types.ObjectId(chapterId)
        : chapterId;
    }
    const pageDoc = await BookPage.findOne(pageFilter).lean().catch(() => null);
    const pageChunks = pageDoc?.extractedText
      ? splitTextIntoChunks(pageDoc.extractedText, requestedPage)
      : [];
    const scoredPageChunks = dedupeChunksByText(pageChunks).map((chunk) => ({
      ...chunk,
      score: lexicalScore(queryTokens, chunk.text || '')
    }));
    return sortChunksByPageAndIndex(
      scoredPageChunks.length ? scoredPageChunks : pageChunks
    )
      .slice(0, MAX_PAGE_RETRIEVED_CHUNKS);
  }

  const filter = { bookId: resolvedBookId };
  if (scope === 'chapter' || scope === 'topic' || scope === 'node') {
    if (chapterId) {
      filter.chapterId = mongoose.Types.ObjectId.isValid(chapterId)
        ? new mongoose.Types.ObjectId(chapterId)
        : chapterId;
    }
  }

  if (scope === 'topic' && topicId) {
    filter.topicId = topicId;
  } else if (scope === 'node' && nodeId) {
    filter.nodeId = nodeId;
  }

  if ((scope === 'chapter' || scope === 'topic' || scope === 'node') && selectedRange) {
    filter.pageStart = { $lte: Number(selectedRange.end || selectedRange.start || 1) };
    filter.pageEnd = { $gte: Number(selectedRange.start || selectedRange.end || 1) };
  }

  const queryEmbedding = await embedText(question || '', { title: 'student question' }).catch(() => null);
  let candidates = [];

  if (queryEmbedding) {
    try {
      candidates = await BookChunk.aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 120,
            limit: 60,
            filter
          }
        },
        {
          $project: {
            bookId: 1,
            chapterId: 1,
            topicId: 1,
            nodeId: 1,
            chunkIndex: 1,
            pageStart: 1,
            pageEnd: 1,
            pageNumbers: 1,
            text: 1,
            embedding: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);
    } catch (err) {
      console.warn('[bookRagService] Atlas vector search unavailable, falling back to lexical retrieval:', err.message);
    }
  }

  if (!candidates.length) {
    candidates = await BookChunk.find(filter).lean();
  }
  if (!candidates.length) return [];

  const pageScoped = scope === 'chapter' || scope === 'topic' || scope === 'node'
    ? candidates.filter((chunk) => {
        if (!selectedRange) return true;
        return Number(chunk.pageStart) <= Number(selectedRange.end || selectedRange.start || 1)
          && Number(chunk.pageEnd) >= Number(selectedRange.start || selectedRange.end || 1);
      })
    : candidates;

  const scored = dedupeChunksByText(pageScoped).map((chunk) => {
    const vectorScore = typeof chunk.score === 'number'
      ? chunk.score
      : (queryEmbedding ? cosineSimilarity(queryEmbedding, chunk.embedding || []) : 0);
    const lexical = lexicalScore(queryTokens, chunk.text || '');
    const pageBoost = scope === 'book' ? 0 : 0;
    return {
      ...chunk,
      score: vectorScore * 0.75 + lexical * 0.25 + pageBoost
    };
  });

  const limit = scope === 'book' ? MAX_BOOK_RETRIEVED_CHUNKS : MAX_CHAPTER_RETRIEVED_CHUNKS;
  return sortChunksByPageAndIndex(scored.sort((a, b) => b.score - a.score).slice(0, limit));
}

function inferAgentAction(question) {
  const text = cleanText(question).toLowerCase();
  if (!text) return 'answer';
  if (/(summari[sz]e|summary|tl;dr|short note)/i.test(text)) return 'summary';
  if (/(detailed note|detailed notes|expand|elaborate|in detail|explain in detail)/i.test(text)) return 'notes';
  if (/(quiz|mcq|multiple choice|objective question|question bank)/i.test(text)) return 'quiz';
  if (/(simply|simple|easy words|beginner|basic)/i.test(text)) return 'simple';
  if (/(compare|difference between|contrast)/i.test(text)) return 'compare';
  if (/(definition|define|meaning of)/i.test(text)) return 'definition';
  return 'answer';
}

async function renderTutorResponse({ action, question, chunks, contextLabel, focusText = '', focusLabel = '', focusPageNumber = null }) {
  const focusChunk = focusText
    ? {
        pageStart: focusPageNumber || chunks[0]?.pageStart || 1,
        pageEnd: focusPageNumber || chunks[0]?.pageEnd || 1,
        pageNumbers: focusPageNumber ? [focusPageNumber] : [],
        text: focusText,
        focusLabel
      }
    : null;
  const contextPieces = [
    focusChunk
      ? `[Highlighted passage${focusLabel ? `: ${focusLabel}` : ''}${focusPageNumber ? ` (Page ${focusPageNumber})` : ''}]\n${focusChunk.text}`
      : '',
    ...chunks.map((chunk) => {
      const pages = Array.isArray(chunk.pageNumbers) && chunk.pageNumbers.length
        ? `Pages ${chunk.pageNumbers.join(', ')}`
        : `Pages ${chunk.pageStart}-${chunk.pageEnd}`;
      return `[${pages}]\n${chunk.text}`;
    })
  ].filter(Boolean);
  const contextText = contextPieces.join('\n\n');

  if (!contextText) {
    return {
      reply: 'This information is not available in the uploaded notes.',
      sources: []
    };
  }

  const sourceItems = [
    ...(focusPageNumber ? [{ pageNumber: focusPageNumber, label: `Page ${focusPageNumber}` }] : []),
    ...formatSourceList(chunks)
  ];
  const uniqueSourceItems = Array.from(new Map(sourceItems.map((item) => [item.label, item])).values());
  const totalWords = cleanText(contextText).split(/\s+/).filter(Boolean).length;
  const isWeakContext = uniqueSourceItems.length === 0 || totalWords < 45 || chunks.length < 1;
  const confidenceLine = isWeakContext
    ? 'I found limited information in the uploaded notes, so this answer may be incomplete.'
    : '';
  const instructionMap = {
    summary: 'Write a student-friendly summary in markdown. Use the exact sections requested and keep the output focused.',
    notes: 'Write concise study notes in markdown with headings, bullets, and clear evidence from the notes.',
    quiz: 'Generate a structured quiz in markdown with one question at a time, options A-D, the correct answer, and a short explanation.',
    simple: 'Explain the concept in beginner-friendly language using markdown headings and short bullets where useful.',
    compare: 'Compare the ideas using compact markdown bullets or a table.',
    definition: 'Give concise definitions with important distinctions and examples if available.',
    answer: 'Answer the question directly and clearly using markdown.'
  };
  const instruction = instructionMap[action] || instructionMap.answer;
  const systemInstruction = [
    'You are an AI tutor.',
    'Answer only using the provided PDF context.',
    'Do not use outside knowledge.',
    'If the answer is not found in the provided context, say exactly: This information is not available in the uploaded notes.',
    'Always include page references inline, but do not add a separate Sources section.',
    'Keep the response student-friendly and concise.',
    'For summaries, use bullet points.',
    'For quizzes, format each question clearly with options A-D, the correct answer, and a short explanation.',
    'If the context is weak or very short, mention that the answer may be incomplete.'
  ].join(' ');

  if (action === 'summary') {
    const title = /current page/i.test(contextLabel || '')
      ? 'Page Summary'
      : /chapter/i.test(contextLabel || '')
        ? 'Chapter Summary'
        : 'Book Summary';
    if (focusText) {
      const { text } = await generateText({
        prompt: [
          `Create a ${title}.`,
          'Use only the highlighted passage.',
          'Structure the answer with these sections in markdown:',
          '## Quick Summary',
          '## Key Points',
          '## Important Terms',
          '## Student-Friendly Explanation',
          'Do not include a Sources section.',
          contextText
        ].join('\n\n'),
        systemInstruction,
        temperature: 0.2
      });
      const reply = stripTrailingSources(String(text || '').trim()) || 'This information is not available in the uploaded notes.';
      return {
        reply: [confidenceLine, reply].filter(Boolean).join('\n\n'),
        sources: uniqueSourceItems
      };
    }
    const batches = [];
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH_SIZE) {
      batches.push(chunks.slice(i, i + CHUNK_BATCH_SIZE));
    }
    const summaries = [];
    for (const batch of batches) {
      const batchText = batch
        .map((chunk) => {
          const pages = Array.isArray(chunk.pageNumbers) && chunk.pageNumbers.length
            ? `Pages ${chunk.pageNumbers.join(', ')}`
            : `Pages ${chunk.pageStart}-${chunk.pageEnd}`;
          return `[${pages}]\n${chunk.text}`;
        })
        .join('\n\n');
      const { text } = await generateText({
        prompt: [
          `Create a partial ${title} for the batch below.`,
          'Use markdown headings and bullet points.',
          'Use only the batch content below.',
          'Do not include a Sources section.',
          batchText
        ].join('\n\n'),
        systemInstruction,
        temperature: 0.2
      });
      const summary = String(text || '').trim();
      if (summary) summaries.push(summary);
    }
    if (!summaries.length) {
      return {
        reply: 'This information is not available in the uploaded notes.',
        sources: uniqueSourceItems
      };
    }
    const { text: finalSummary } = await generateText({
      prompt: [
        `Combine the partial summaries into one final ${title}.`,
        'Use the following markdown sections:',
        '## Quick Summary',
        '## Key Points',
        '## Important Terms',
        '## Student-Friendly Explanation',
        'Do not include a Sources section.',
        ...summaries
      ].join('\n\n'),
      systemInstruction,
      temperature: 0.2
    });
    const reply = stripTrailingSources(String(finalSummary || summaries.join('\n\n')).trim()) || 'This information is not available in the uploaded notes.';
    return {
      reply: [confidenceLine, reply].filter(Boolean).join('\n\n'),
      sources: uniqueSourceItems
    };
  }

  const answerTitle =
    action === 'quiz' ? 'AI Quiz' :
    action === 'simple' ? 'AI Answer' :
    action === 'notes' ? 'AI Answer' :
    action === 'compare' ? 'AI Answer' :
    action === 'definition' ? 'AI Answer' :
    'AI Answer';

  const prompt = [
    `Answer title: ${answerTitle}`,
    `Context used: ${contextLabel}`,
    `Question or request: ${question}`,
    '',
    'Use only the uploaded notes below.',
    'Cite source page numbers inline, for example "(p. 4)" or "(pp. 4-6)".',
    'If the answer is missing from the notes, say: "This information is not available in the uploaded notes."',
    'Use this structure:',
    action === 'quiz'
      ? [
          '## Question',
          '## Options A-D',
          '## Correct Answer',
          '## Explanation'
        ].join('\n')
      : [
          '## Direct Answer',
          '## Explanation',
          '## Evidence from Notes'
        ].join('\n'),
    '',
    'Uploaded notes:',
    contextText
  ].join('\n');

  const { text } = await generateText({
    prompt: `${instruction}\n\n${prompt}`,
    systemInstruction,
    temperature: action === 'quiz' ? 0.4 : 0.2
  });

  const reply = stripTrailingSources(String(text || '').replace(/\r/g, '').trim()) || 'This information is not available in the uploaded notes.';
  return {
    reply: [confidenceLine, reply].filter(Boolean).join('\n\n'),
    sources: uniqueSourceItems
  };
}

async function answerBookTutorRequest({
  bookId,
  chapterId,
  topicId,
  nodeId,
  pageNumber,
  question,
  scope = 'book',
  selectedTopicTitle,
  selectedChapterTitle,
  selectedNodeTitle,
  focusText,
  focusLabel,
  focusPageNumber,
  forceAction
}) {
  const action = forceAction || inferAgentAction(question);
  const chunks = await retrieveRelevantChunks({
    bookId,
    chapterId,
    topicId,
    nodeId,
    pageNumber,
    question,
    scope
  });

  const contextLabel = [
    scope === 'page' ? `Current page ${pageNumber}` : null,
    scope === 'node' ? `Node: ${selectedNodeTitle || nodeId || 'selected node'}` : null,
    scope === 'topic' ? `Topic: ${selectedTopicTitle || topicId || 'selected topic'}` : null,
    scope === 'chapter' ? `Chapter: ${selectedChapterTitle || chapterId || 'selected chapter'}` : null,
    scope === 'book' ? 'Full book' : null
  ].filter(Boolean).join(' | ');

  const reply = await renderTutorResponse({
    action,
    question,
    chunks,
    contextLabel,
    focusText,
    focusLabel,
    focusPageNumber
  });

  return {
    action,
    chunks,
    contextLabel,
    reply: reply.reply,
    sources: reply.sources || []
  };
}

async function getBookKnowledgeSnapshot(bookId) {
  const knowledge = await getOrCreateBookKnowledge(bookId);
  const bookObjectId = mongoose.Types.ObjectId.isValid(bookId) ? new mongoose.Types.ObjectId(bookId) : bookId;
  const [pageCount, chunkCount, embeddedCount, emptyCount] = await Promise.all([
    BookPage.countDocuments({ bookId: bookObjectId }),
    BookChunk.countDocuments({ bookId: bookObjectId }),
    BookChunk.countDocuments({ bookId: bookObjectId, embedding: { $exists: true, $ne: [] } }),
    BookPage.countDocuments({ bookId: bookObjectId, processingStatus: 'empty' })
  ]).catch(() => [0, 0, 0, 0]);

  return {
    ...knowledge,
    status: normalizeStatus(knowledge.status),
    totalPages: knowledge.totalPages || pageCount,
    extractedPages: knowledge.extractedPages || pageCount - emptyCount,
    emptyPages: knowledge.emptyPages || emptyCount,
    totalChunks: knowledge.totalChunks || chunkCount,
    embeddedChunks: knowledge.embeddedChunks || embeddedCount,
    vectorIndexStatus: knowledge.vectorIndexStatus || (chunkCount > 0 ? 'ready' : 'not_started'),
    lastProcessingError: knowledge.lastProcessingError || ''
  };
}

module.exports = {
  queueBookKnowledge,
  processBookKnowledge,
  getBookKnowledgeSnapshot,
  answerBookTutorRequest,
  retrieveRelevantChunks,
  inferAgentAction,
  cleanText
};
