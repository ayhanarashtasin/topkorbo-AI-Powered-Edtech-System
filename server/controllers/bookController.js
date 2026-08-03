const { bucket } = require('../config/firebase');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Book = require('../models/Book');
const Annotation = require('../models/Annotation');
const ReadingState = require('../models/ReadingState');
const BookKnowledge = require('../models/BookKnowledge');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const planService = require('../services/planService');
const { queueBookKnowledge, getBookKnowledgeSnapshot } = require('../services/bookRagService');
const {
  MAX_ANNOTATIONS_PER_BATCH,
  MAX_POINTS_PER_BATCH,
  buildAnnotationDoc,
  validateClientId,
  validatePageNumber
} = require('../utils/annotationValidation');

const VALID_CATEGORIES = ['Academic', 'Admission'];
const VALID_GROUPS = ['Science', 'Arts', 'Commerce', 'HSC', 'Engineering', 'Medical', 'Varsity'];
const VALID_PAPERS = ['1st', '2nd', 'N/A'];

// Books we've already auto-triggered a mind map rebuild for this server run.
// Bounds the self-heal to one rebuild per book per process, so a book whose
// tree legitimately builds empty can't cause the reader's poll to loop.
const mindMapRebuildTriggered = new Set();

function getMindMapStats(node) {
  if (!node) return { total: 0, contentNodes: 0 };
  const nodeType = String(node.nodeType || '').toLowerCase();
  const children = Array.isArray(node.children) ? node.children : [];
  return children.reduce((stats, child) => {
    const childStats = getMindMapStats(child);
    return {
      total: stats.total + childStats.total,
      contentNodes: stats.contentNodes + childStats.contentNodes
    };
  }, {
    total: 1,
    contentNodes: ['topic', 'subtopic', 'point'].includes(nodeType) ? 1 : 0
  });
}

async function cleanupUploadedFile(file) {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Temporary upload cleanup error:', err);
    }
  }
}

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

function canAccessBook(book, user) {
  if (!book || !user) return false;
  const isOwner = book.uploadedBy && String(book.uploadedBy) === String(user.id);
  const isAdmin = user.role === 'admin';
  return isOwner || isAdmin || book.isPublished !== false;
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return false;

  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;

  if (start === null && end === null) return false;
  if (start === null) {
    start = Math.max(size - end, 0);
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return false;
  }
  return { start, end };
}

function streamLocalPdf(fileUrl, req, res) {
  const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
  const relativePath = fileUrl.replace(/^\/uploads\//, '');
  const filePath = path.resolve(uploadsRoot, relativePath);

  if (!filePath.startsWith(uploadsRoot + path.sep) || !fs.existsSync(filePath)) {
    return ApiResponse.error(res, 'PDF file not found', 404);
  }

  const size = fs.statSync(filePath).size;
  const range = parseRange(req.headers.range, size);
  res.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': 'application/pdf',
    'Cache-Control': 'private, max-age=300'
  });

  if (range === false) {
    res.set('Content-Range', `bytes */${size}`);
    return res.sendStatus(416);
  }
  if (range) {
    res.status(206).set({
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': String(range.end - range.start + 1)
    });
    return fs.createReadStream(filePath, range).pipe(res);
  }

  res.set('Content-Length', String(size));
  return fs.createReadStream(filePath).pipe(res);
}

const uploadFileToFirebase = (file, userId) => {
  return new Promise((resolve, reject) => {
    const safeName = (file.originalname || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `books/${userId}/${Date.now()}-${safeName}`;
    const fileUpload = bucket.file(fileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: file.mimetype }
    });

    blobStream.on('error', (error) => reject(error));
    blobStream.on('finish', async () => {
      try {
        await fileUpload.makePublic(); // Requires public read access on bucket
        resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
      } catch (err) {
        // Fallback for uniform bucket-level access if makePublic is denied
        resolve(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`);
      }
    });
    if (file.buffer) {
      blobStream.end(file.buffer);
      return;
    }
    if (file.path) {
      fs.createReadStream(file.path)
        .on('error', (error) => reject(error))
        .pipe(blobStream);
      return;
    }
    reject(new Error('No PDF file data found'));
  });
};

const deleteFileFromFirebase = async (fileUrl) => {
  try {
    if (!fileUrl) return;
    let filePath = '';
    const storagePrefix = `https://storage.googleapis.com/${bucket.name}/`;
    const fbPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;
    
    if (fileUrl.startsWith(storagePrefix)) {
      filePath = fileUrl.replace(storagePrefix, '');
    } else if (fileUrl.startsWith(fbPrefix)) {
      filePath = decodeURIComponent(fileUrl.replace(fbPrefix, '').split('?')[0]);
    }

    if (filePath) {
      await bucket.file(filePath).delete();
    }
  } catch (err) {
    console.error('Firebase delete error:', err);
  }
};


/**
 * Returns true if the given string is a valid Mongo ObjectId (24 hex chars).
 * Used by `:id` route handlers to short-circuit the CastError and return a
 * clean 404 instead of letting the bad id reach `Book.findById()`.
 */
function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

/**
 * @desc    Create a new book (with first chapter PDF) — teacher only
 * @route   POST /api/books
 * @access  Private (teacher)
 */
exports.createBook = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      // Clean up uploaded file if role rejected
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Only teachers can upload books', 403);
    }

    const {
      title, description, category, group, subject, paper, isPublished,
      chapterNumber, chapterTitle, firstChapterTitle, firstChapterNumber
    } = req.body;

    if (!title || !title.trim()) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Title is required', 400);
    }
    if (!VALID_CATEGORIES.includes(category)) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Invalid category', 400);
    }
    if (!VALID_GROUPS.includes(group)) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Invalid group', 400);
    }
    if (!subject || !subject.trim()) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Subject is required', 400);
    }
    if (!VALID_PAPERS.includes(paper)) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Invalid paper', 400);
    }
    if (!req.file) {
      return ApiResponse.error(res, 'PDF file is required (chapter 1)', 400);
    }

    const numRaw = chapterNumber || firstChapterNumber;
    const chNum = parseInt(numRaw, 10);
    const orderVal = !isNaN(chNum) ? chNum - 1 : 0;
    const chTitle = (chapterTitle || firstChapterTitle || '').trim() || 'Chapter 1';

    const fileUrl = await uploadFileToFirebase(req.file, user._id);
    await cleanupUploadedFile(req.file);

    const book = await Book.create({
      title: title.trim(),
      description: (description || '').trim(),
      category,
      group,
      subject: subject.trim(),
      paper,
      uploadedBy: user._id,
      isPublished: isPublished !== 'false' && isPublished !== false,
      chapters: [{
        title: chTitle,
        order: orderVal,
        fileUrl,
        fileSize: req.file.size,
        pageCount: 0
      }]
    });

    queueBookKnowledge(book._id).catch((err) => {
      console.error('[bookController] Failed to queue book knowledge:', err.message);
    });

    return ApiResponse.success(res, book, 'Book created successfully', 201);
  } catch (err) {
    // Clean up uploaded file on error
    await cleanupUploadedFile(req.file);
    next(err);
  }
};

/**
 * @desc    Add a chapter to an existing book — teacher only (owner)
 * @route   POST /api/books/:id/chapters
 * @access  Private (teacher)
 */
exports.addChapter = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Only teachers can add chapters', 403);
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Book not found', 404);
    }
    if (book.uploadedBy.toString() !== user._id.toString()) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'You can only add chapters to your own books', 403);
    }

    const { title } = req.body;
    if (!title || !title.trim()) {
      await cleanupUploadedFile(req.file);
      return ApiResponse.error(res, 'Chapter title is required', 400);
    }
    if (!req.file) {
      return ApiResponse.error(res, 'PDF file is required', 400);
    }

    const fileUrl = await uploadFileToFirebase(req.file, user._id);
    await cleanupUploadedFile(req.file);

    const newChapter = {
      title: title.trim(),
      order: book.chapters.length,
      fileUrl,
      fileSize: req.file.size,
      pageCount: 0
    };
    book.chapters.push(newChapter);
    await book.save();

    queueBookKnowledge(book._id, { force: true }).catch((err) => {
      console.error('[bookController] Failed to requeue book knowledge:', err.message);
    });

    return ApiResponse.success(res, book, 'Chapter added successfully', 201);
  } catch (err) {
    await cleanupUploadedFile(req.file);
    next(err);
  }
};

/**
 * @desc    List books with optional filters
 * @route   GET /api/books
 * @access  Private
 */
exports.listBooks = async (req, res, next) => {
  try {
    const match = { isPublished: true };
    if (req.query.category && VALID_CATEGORIES.includes(req.query.category)) {
      match.category = req.query.category;
    }
    if (req.query.group && VALID_GROUPS.includes(req.query.group)) {
      match.group = req.query.group;
    }
    if (req.query.subject) {
      match.subject = req.query.subject;
    }
    if (req.query.paper && VALID_PAPERS.includes(req.query.paper)) {
      match.paper = req.query.paper;
    }
    if (req.query.uploadedBy) {
      match.uploadedBy = req.query.uploadedBy;
    }

    const books = await Book.find(match)
      .select('title description category group subject paper isPublished createdAt chapters uploadedBy')
      .populate('uploadedBy', 'name avatar email')
      .sort({ createdAt: -1 })
      .lean();

    // Map chapters to lightweight summary (no fileUrl)
    const result = books.map((b) => ({
      ...b,
      chapterCount: (b.chapters || []).length,
      chapters: (b.chapters || []).map((c) => ({
        _id: c._id,
        title: c.title,
        order: c.order,
        pageCount: c.pageCount
      }))
    }));

    const knowledgeDocs = await BookKnowledge.find({ bookId: { $in: result.map((book) => book._id) } })
      .select('bookId status')
      .lean();
    const knowledgeStatuses = knowledgeDocs.map((doc) => [String(doc.bookId), doc.status || 'pending']);
    const knowledgeStatusMap = Object.fromEntries(knowledgeStatuses);
    result.forEach((book) => {
      book.knowledgeStatus = knowledgeStatusMap[String(book._id)] || 'pending';
    });

    return ApiResponse.success(res, { books: result, total: result.length }, 'Books fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get full book detail (without chapter fileUrls)
 * @route   GET /api/books/:id
 * @access  Private
 */
exports.getBookDetail = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const book = await Book.findById(req.params.id)
      .populate('uploadedBy', 'name avatar role')
      .lean();
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const knowledge = await getBookKnowledgeSnapshot(book._id).catch(() => null);
    // Strip fileUrl from chapter list returned here
    const safeChapters = (book.chapters || []).map((c) => ({
      _id: c._id,
      title: c.title,
      order: c.order,
      pageCount: c.pageCount,
      fileSize: c.fileSize,
      createdAt: c.createdAt
    }));
    return ApiResponse.success(res, {
      ...book,
      chapters: safeChapters,
      knowledgeStatus: knowledge?.status || 'pending',
      knowledgeMessage: knowledge?.message || ''
    }, 'Book detail fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get the processed knowledge structure for a book
 * @route   GET /api/books/:id/knowledge
 * @access  Private
 */
exports.getKnowledge = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const book = await Book.findById(req.params.id).select('_id title chapters').lean();
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const knowledge = await getBookKnowledgeSnapshot(book._id);
    if (!knowledge || ['pending', 'not_started', 'failed'].includes(knowledge.status)) {
      queueBookKnowledge(book._id).catch((err) => {
        console.error('[bookController] Failed to queue knowledge load:', err.message);
      });
    }

    // Self-heal books that were processed before the mind map feature was
    // enabled: a completed book with no usable tree (null, or a hollow shell
    // with no chapter nodes) was built while ENABLE_KNOWLEDGE_TREE was off.
    // Force a one-time rebuild so the tree/mind map actually gets created.
    // The Set guard bounds this to a single rebuild per book per server run,
    // so a book whose tree genuinely builds empty won't loop the reader's poll.
    const KNOWLEDGE_TREE_ENABLED = String(process.env.ENABLE_KNOWLEDGE_TREE || '').toLowerCase() === 'true';
    const treeChildCount = knowledge?.tree?.children?.length || 0;
    const treeMissing = !knowledge?.tree || treeChildCount === 0;
    const treeStats = getMindMapStats(knowledge?.tree);
    const treeTooShallow = Number(knowledge?.sourcePages || 0) >= 5 && treeStats.contentNodes < 8;
    const alreadyTriggered = mindMapRebuildTriggered.has(String(book._id));
    const needsTreeRebuild = KNOWLEDGE_TREE_ENABLED && knowledge?.status === 'completed' && (treeMissing || treeTooShallow) && !alreadyTriggered;
    if (needsTreeRebuild) {
      mindMapRebuildTriggered.add(String(book._id));
      queueBookKnowledge(book._id, { force: true }).catch((err) => {
        console.error('[bookController] Failed to queue mind map rebuild:', err.message);
      });
    }

    return ApiResponse.success(res, {
      bookId: book._id,
      bookTitle: book.title,
      status: needsTreeRebuild ? 'indexing' : (knowledge?.status || 'pending'),
      message: needsTreeRebuild ? 'Building the mind map…' : (knowledge?.message || 'Processing has been queued'),
      documentType: knowledge?.documentType || 'unknown',
      tree: knowledge?.tree || null,
      nodes: knowledge?.nodes || [],
      chapters: knowledge?.chapters || [],
      completedAt: knowledge?.completedAt || null,
      startedAt: knowledge?.startedAt || null,
      sourcePages: knowledge?.sourcePages || 0,
      totalPages: knowledge?.totalPages || 0,
      extractedPages: knowledge?.extractedPages || 0,
      emptyPages: knowledge?.emptyPages || 0,
      totalChunks: knowledge?.totalChunks || 0,
      embeddedChunks: knowledge?.embeddedChunks || 0,
      vectorIndexStatus: knowledge?.vectorIndexStatus || 'not_started',
      lastProcessingError: knowledge?.lastProcessingError || '',
      currentBookId: book._id
    }, 'Book knowledge fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List chapters for a book (lightweight)
 * @route   GET /api/books/:id/chapters
 * @access  Private
 */
exports.listChapters = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const book = await Book.findById(req.params.id)
      .select('chapters title uploadedBy')
      .populate('uploadedBy', 'name avatar role')
      .lean();
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const chapters = (book.chapters || [])
      .map((c) => ({
        _id: c._id,
        title: c.title,
        order: c.order,
        pageCount: c.pageCount
      }))
      .sort((a, b) => a.order - b.order);

    return ApiResponse.success(res, {
      bookId: book._id,
      bookTitle: book.title,
      uploadedBy: book.uploadedBy,
      chapters
    }, 'Chapters fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get a single chapter's metadata including fileUrl
 * @route   GET /api/books/:id/chapters/:cid
 * @access  Private
 */
exports.getChapterMeta = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.cid)) {
      return ApiResponse.error(res, 'Invalid book or chapter id', 400);
    }
    const book = await Book.findOne(
      { _id: req.params.id, 'chapters._id': req.params.cid },
      { 'chapters.$': 1 }
    ).lean();
    if (!book || !book.chapters || book.chapters.length === 0) {
      return ApiResponse.error(res, 'Book or Chapter not found', 404);
    }
    // Free plan may open at most N distinct books (Pro/Pro+ unlimited). This is
    // the per-chapter read entry, so it is the natural choke point for the cap.
    const reader = await planService.loadUser(req.user.id);
    await planService.assertBookOpenable(reader, req.params.id);
    const chapter = {
      ...book.chapters[0],
      fileUrl: `/api/books/${req.params.id}/chapters/${req.params.cid}/pdf`
    };
    return ApiResponse.success(res, { chapter }, 'Chapter metadata fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Stream a chapter PDF through the API so the reader does not depend
 *          on public Firebase Storage URLs or bucket CORS settings.
 * @route   GET /api/books/:id/chapters/:cid/pdf
 * @access  Private
 */
exports.streamChapterPdf = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.cid)) {
      return ApiResponse.error(res, 'Invalid book or chapter id', 400);
    }

    const book = await Book.findOne(
      { _id: req.params.id, 'chapters._id': req.params.cid },
      { 'chapters.$': 1, uploadedBy: 1, isPublished: 1, approvalStatus: 1 }
    ).lean();
    if (!book || !book.chapters || book.chapters.length === 0) {
      return ApiResponse.error(res, 'Book or Chapter not found', 404);
    }
    if (!canAccessBook(book, req.user)) {
      return ApiResponse.error(res, 'Book or Chapter not found', 404);
    }

    // Access control — the raw PDF stream must enforce the same rules as the
    // chapter-metadata endpoint (previously it was wide open to anyone with an
    // id): unpublished books are visible only to their owner or an admin, and
    // free-plan book-open caps apply to everyone else.
    const isOwner = book.uploadedBy && String(book.uploadedBy) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';
    if (!book.isPublished && !isOwner && !isAdmin) {
      return ApiResponse.error(res, 'Book or Chapter not found', 404);
    }
    if (!isOwner && !isAdmin) {
      const reader = await planService.loadUser(req.user.id);
      await planService.assertBookOpenable(reader, req.params.id);
    }

    const fileUrl = book.chapters[0].fileUrl;
    if (fileUrl && fileUrl.startsWith('/uploads/')) {
      return streamLocalPdf(fileUrl, req, res);
    }

    const filePath = storagePathFromUrl(fileUrl);
    if (!filePath) {
      return ApiResponse.error(res, 'PDF file not found', 404);
    }

    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return ApiResponse.error(res, 'PDF file not found', 404);
    }

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size || 0);
    const range = parseRange(req.headers.range, size);

    res.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': metadata.contentType || 'application/pdf',
      'Cache-Control': 'private, max-age=300'
    });

    if (range === false) {
      res.set('Content-Range', `bytes */${size}`);
      return res.sendStatus(416);
    }
    if (range) {
      res.status(206).set({
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Length': String(range.end - range.start + 1)
      });
      return file.createReadStream({ start: range.start, end: range.end })
        .on('error', next)
        .pipe(res);
    }

    res.set('Content-Length', String(size));
    return file.createReadStream()
      .on('error', next)
      .pipe(res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get the distinct taxonomy values to power the browse dropdowns
 * @route   GET /api/books/taxonomy
 * @access  Private
 */
exports.getTaxonomy = async (req, res, next) => {
  try {
    const [categories, groups, subjects, papers] = await Promise.all([
      Book.distinct('category', { isPublished: true }),
      Book.distinct('group', { isPublished: true }),
      Book.distinct('subject', { isPublished: true }),
      Book.distinct('paper', { isPublished: true })
    ]);
    return ApiResponse.success(res, {
      categories: categories.filter(Boolean),
      groups: groups.filter(Boolean),
      subjects: subjects.filter(Boolean).sort(),
      papers: papers.filter(Boolean)
    }, 'Taxonomy fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update book metadata — teacher only (owner)
 * @route   PUT /api/books/:id
 * @access  Private (teacher)
 */
exports.updateBook = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can update books', 403);
    }
    const book = await Book.findById(req.params.id);
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    if (book.uploadedBy.toString() !== user._id.toString()) {
      return ApiResponse.error(res, 'You can only edit your own books', 403);
    }

    const { title, description, isPublished, category, group, subject, paper } = req.body;
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return ApiResponse.error(res, 'Title cannot be empty', 400);
      }
      book.title = title.trim();
    }
    if (description !== undefined) {
      book.description = (description || '').trim();
    }
    if (isPublished !== undefined) {
      book.isPublished = !!isPublished;
    }
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return ApiResponse.error(res, 'Invalid category', 400);
      }
      book.category = category;
    }
    if (group !== undefined) {
      if (!VALID_GROUPS.includes(group)) {
        return ApiResponse.error(res, 'Invalid group', 400);
      }
      book.group = group;
    }
    if (subject !== undefined) {
      if (!subject || !subject.trim()) {
        return ApiResponse.error(res, 'Subject cannot be empty', 400);
      }
      book.subject = subject.trim();
    }
    if (paper !== undefined) {
      if (!VALID_PAPERS.includes(paper)) {
        return ApiResponse.error(res, 'Invalid paper', 400);
      }
      book.paper = paper;
    }
    await book.save();
    return ApiResponse.success(res, book, 'Book updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a book — teacher only (owner)
 * @route   DELETE /api/books/:id
 * @access  Private (teacher)
 */
exports.deleteBook = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can delete books', 403);
    }
    const book = await Book.findById(req.params.id);
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    if (book.uploadedBy.toString() !== user._id.toString()) {
      return ApiResponse.error(res, 'You can only delete your own books', 403);
    }
    // Best-effort delete associated PDF files from Firebase
    for (const ch of book.chapters || []) {
      await deleteFileFromFirebase(ch.fileUrl);
    }
    await Book.deleteOne({ _id: book._id });
    return ApiResponse.success(res, { id: req.params.id }, 'Book deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a chapter — teacher only (owner)
 * @route   DELETE /api/books/:id/chapters/:cid
 * @access  Private (teacher)
 */
exports.deleteChapter = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'teacher') {
      return ApiResponse.error(res, 'Only teachers can delete chapters', 403);
    }
    const book = await Book.findById(req.params.id);
    if (!book) {
      return ApiResponse.error(res, 'Book not found', 404);
    }
    if (book.uploadedBy.toString() !== user._id.toString()) {
      return ApiResponse.error(res, 'You can only edit your own books', 403);
    }
    const chIdx = book.chapters.findIndex((c) => String(c._id) === String(req.params.cid));
    if (chIdx === -1) {
      return ApiResponse.error(res, 'Chapter not found', 404);
    }
    const removed = book.chapters[chIdx];
    await deleteFileFromFirebase(removed.fileUrl);
    book.chapters.splice(chIdx, 1);
    // Re-sequence orders
    book.chapters.forEach((c, i) => { c.order = i; });
    await book.save();
    return ApiResponse.success(res, book, 'Chapter deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create an annotation (pen)
 * @route   POST /api/books/annotations
 * @access  Private
 */
/**
 * @desc    Create an annotation (pen)
 * @route   POST /api/books/annotations
 * @access  Private
 */
exports.createAnnotation = async (req, res, next) => {
  try {
    const {
      bookId, chapterId, pageNumber, clientId, type, color,
      points, strokeWidth, referenceWidth
    } = req.body;

    if (!bookId || !isValidObjectId(bookId) || !chapterId || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Valid bookId and chapterId are required', 400);
    }
    const pageResult = validatePageNumber(pageNumber);
    if (pageResult.error) return ApiResponse.error(res, pageResult.error, 400);

    // Bind the chapter to the book supplied by the client. Looking up only by
    // the embedded chapter id would allow inconsistent cross-book records.
    const book = await Book.findOne({ _id: bookId, 'chapters._id': chapterId }).select('_id').lean();
    if (!book) {
      return ApiResponse.error(res, 'Book or chapter not found', 404);
    }

    const { doc, error } = buildAnnotationDoc(
      { clientId, type, color, points, strokeWidth, referenceWidth },
      { userId: req.user.id, bookId: book._id, chapterId, pageNumber: pageResult.value }
    );
    if (error) return ApiResponse.error(res, error, 400);

    const annotation = await Annotation.findOneAndUpdate(
      { userId: req.user.id, clientId: doc.clientId },
      { $setOnInsert: doc },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return ApiResponse.success(res, annotation, 'Annotation saved', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List user's annotations for one chapter page
 * @route   GET /api/books/annotations?chapterId=...&page=...
 * @access  Private
 */
exports.listAnnotations = async (req, res, next) => {
  try {
    const { chapterId, page } = req.query;
    if (!chapterId) {
      return ApiResponse.error(res, 'chapterId is required', 400);
    }
    if (!isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Invalid chapter id', 400);
    }
    if (!page) return ApiResponse.error(res, 'page is required', 400);
    const pageResult = validatePageNumber(page);
    if (pageResult.error) return ApiResponse.error(res, pageResult.error, 400);
    const match = { userId: req.user.id, chapterId, pageNumber: pageResult.value };
    const annotations = await Annotation.find(match)
      .sort({ createdAt: 1 })
      .lean();
    return ApiResponse.success(res, { annotations, total: annotations.length }, 'Annotations fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete an annotation (owner only)
 * @route   DELETE /api/books/annotations/:id
 * @access  Private
 */
exports.deleteAnnotation = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Annotation not found', 404);
    }
    const result = await Annotation.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return ApiResponse.error(res, 'Annotation not found', 404);
    }
    return ApiResponse.success(res, { id: req.params.id }, 'Annotation deleted');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Bulk-create pen annotations for a single page.
 *          Used by the client to amortise N small POSTs (one per stroke)
 *          into a single round-trip every ~5 s. The same per-stroke
 *          validation that the single endpoint applies is applied here.
 * @route   POST /api/books/annotations/bulk
 * @access  Private
 * @body    { bookId, chapterId, pageNumber, annotations: [...] }
 *          Each entry: { type, color, points: [{x,y,w?,p?}], strokeWidth }
 */
exports.createAnnotationsBulk = async (req, res, next) => {
  try {
    const { bookId, chapterId, pageNumber, annotations } = req.body;

    if (!bookId || !isValidObjectId(bookId) || !chapterId || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Valid bookId and chapterId are required', 400);
    }
    const pageResult = validatePageNumber(pageNumber);
    if (pageResult.error) return ApiResponse.error(res, pageResult.error, 400);
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return ApiResponse.error(res, 'annotations[] is required and must not be empty', 400);
    }
    if (annotations.length > MAX_ANNOTATIONS_PER_BATCH) {
      return ApiResponse.error(res, `Too many annotations in one batch (max ${MAX_ANNOTATIONS_PER_BATCH})`, 413);
    }

    const book = await Book.findOne({ _id: bookId, 'chapters._id': chapterId }).select('_id').lean();
    if (!book) return ApiResponse.error(res, 'Book or chapter not found', 404);

    const docs = [];
    const seenClientIds = new Set();
    let totalPoints = 0;
    const ctx = {
      userId: req.user.id,
      bookId: book._id,
      chapterId,
      pageNumber: pageResult.value
    };
    for (let i = 0; i < annotations.length; i += 1) {
      const { doc, error } = buildAnnotationDoc(annotations[i], ctx);
      if (error) {
        return ApiResponse.error(res, `annotations[${i}]: ${error}`, 400);
      }
      if (seenClientIds.has(doc.clientId)) {
        return ApiResponse.error(res, `annotations[${i}]: duplicate clientId`, 400);
      }
      seenClientIds.add(doc.clientId);
      totalPoints += doc.points.length;
      if (totalPoints > MAX_POINTS_PER_BATCH) {
        return ApiResponse.error(res, `Annotation batch may contain at most ${MAX_POINTS_PER_BATCH} points`, 413);
      }
      docs.push(doc);
    }

    const now = new Date();
    await Annotation.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { userId: req.user.id, clientId: doc.clientId },
          update: { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
          upsert: true
        }
      })),
      { ordered: false }
    );

    const stored = await Annotation.find({
      userId: req.user.id,
      clientId: { $in: docs.map((doc) => doc.clientId) }
    }).lean();
    const byClientId = new Map(stored.map((doc) => [doc.clientId, doc]));
    const saved = docs.map((doc) => byClientId.get(doc.clientId)).filter(Boolean);

    return ApiResponse.success(
      res,
      { annotations: saved, insertedCount: saved.length },
      `Saved ${saved.length} annotation${saved.length === 1 ? '' : 's'}`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Reconcile pen-stroke operations for one page. Each clientId has a single
 * final intent (upsert or delete), making retries, undo, redo, and pagehide
 * replay idempotent.
 *
 * @route POST /api/books/annotations/sync
 * @body  { bookId, chapterId, pageNumber, upserts: [...], deletes: [{clientId,id?}] }
 */
exports.syncAnnotations = async (req, res, next) => {
  try {
    const { bookId, chapterId, pageNumber } = req.body;
    const upserts = req.body.upserts === undefined ? [] : req.body.upserts;
    const deletes = req.body.deletes === undefined ? [] : req.body.deletes;

    if (!bookId || !isValidObjectId(bookId) || !chapterId || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Valid bookId and chapterId are required', 400);
    }
    const pageResult = validatePageNumber(pageNumber);
    if (pageResult.error) return ApiResponse.error(res, pageResult.error, 400);
    if (!Array.isArray(upserts) || !Array.isArray(deletes) || (upserts.length === 0 && deletes.length === 0)) {
      return ApiResponse.error(res, 'At least one upsert or delete operation is required', 400);
    }
    if (upserts.length > MAX_ANNOTATIONS_PER_BATCH || deletes.length > MAX_ANNOTATIONS_PER_BATCH) {
      return ApiResponse.error(res, `A sync batch may contain at most ${MAX_ANNOTATIONS_PER_BATCH} operations of each type`, 413);
    }

    const book = await Book.findOne({ _id: bookId, 'chapters._id': chapterId }).select('_id').lean();
    if (!book) return ApiResponse.error(res, 'Book or chapter not found', 404);

    const context = {
      userId: req.user.id,
      bookId: book._id,
      chapterId,
      pageNumber: pageResult.value
    };
    const docs = [];
    const legacySources = [];
    const clientIds = new Set();
    let totalPoints = 0;
    for (let index = 0; index < upserts.length; index += 1) {
      const result = buildAnnotationDoc(upserts[index], context);
      if (result.error) return ApiResponse.error(res, `upserts[${index}]: ${result.error}`, 400);
      if (clientIds.has(result.doc.clientId)) {
        return ApiResponse.error(res, `upserts[${index}]: duplicate clientId`, 400);
      }
      clientIds.add(result.doc.clientId);
      totalPoints += result.doc.points.length;
      if (totalPoints > MAX_POINTS_PER_BATCH) {
        return ApiResponse.error(res, `Sync batch may contain at most ${MAX_POINTS_PER_BATCH} points`, 413);
      }
      docs.push(result.doc);
      if (upserts[index].id !== undefined) {
        if (!isValidObjectId(upserts[index].id)) {
          return ApiResponse.error(res, `upserts[${index}].id is not a valid ObjectId`, 400);
        }
        legacySources.push({ id: upserts[index].id, clientId: result.doc.clientId });
      }
    }

    const deleteClientIds = [];
    const deleteIds = [];
    for (let index = 0; index < deletes.length; index += 1) {
      const operation = deletes[index];
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        return ApiResponse.error(res, `deletes[${index}] must be an object`, 400);
      }
      if (operation.clientId !== undefined) {
        const clientId = validateClientId(operation.clientId);
        if (clientId.error) return ApiResponse.error(res, `deletes[${index}]: ${clientId.error}`, 400);
        if (clientIds.has(clientId.value)) {
          return ApiResponse.error(res, `clientId ${clientId.value} cannot be upserted and deleted in one batch`, 400);
        }
        clientIds.add(clientId.value);
        deleteClientIds.push(clientId.value);
      }
      if (operation.id !== undefined) {
        if (!isValidObjectId(operation.id)) {
          return ApiResponse.error(res, `deletes[${index}].id is not a valid ObjectId`, 400);
        }
        deleteIds.push(operation.id);
      }
      if (operation.clientId === undefined && operation.id === undefined) {
        return ApiResponse.error(res, `deletes[${index}] needs clientId or id`, 400);
      }
    }

    const now = new Date();
    if (legacySources.length > 0) {
      await Annotation.bulkWrite(legacySources.map((source) => ({
        updateOne: {
          filter: {
            _id: source.id,
            userId: req.user.id,
            chapterId,
            pageNumber: pageResult.value,
            $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }]
          },
          update: { $set: { clientId: source.clientId, updatedAt: now } }
        }
      })), { ordered: false });
    }
    if (docs.length > 0) {
      await Annotation.bulkWrite(
        docs.map((doc) => ({
          updateOne: {
            filter: { userId: req.user.id, clientId: doc.clientId },
            update: { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
            upsert: true
          }
        })),
        { ordered: false }
      );
    }

    let deletedCount = 0;
    if (deleteClientIds.length > 0 || deleteIds.length > 0) {
      const identifiers = [];
      if (deleteClientIds.length > 0) identifiers.push({ clientId: { $in: deleteClientIds } });
      if (deleteIds.length > 0) identifiers.push({ _id: { $in: deleteIds } });
      const result = await Annotation.deleteMany({
        userId: req.user.id,
        chapterId,
        pageNumber: pageResult.value,
        $or: identifiers
      });
      deletedCount = result.deletedCount || 0;
    }

    const stored = docs.length > 0
      ? await Annotation.find({
        userId: req.user.id,
        clientId: { $in: docs.map((doc) => doc.clientId) }
      }).lean()
      : [];
    const byClientId = new Map(stored.map((doc) => [doc.clientId, doc]));
    const saved = docs.map((doc) => byClientId.get(doc.clientId)).filter(Boolean);

    return ApiResponse.success(res, {
      annotations: saved,
      deletedClientIds: deleteClientIds,
      deletedCount
    }, 'Annotation sync complete');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Bulk-delete annotations by id (owner only).
 *          Used by undo-of-erase flows that need to remove a stroke
 *          optimistically and reconcile with the server in one request.
 * @route   POST /api/books/annotations/bulk-delete
 * @access  Private
 * @body    { ids: [ObjectId, ...] }
 */
exports.deleteAnnotationsBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return ApiResponse.error(res, 'ids[] is required', 400);
    }
    // Validate every id; reject the request if any look malformed so a
    // typo doesn't silently delete the wrong records.
    for (let i = 0; i < ids.length; i += 1) {
      if (!isValidObjectId(ids[i])) {
        return ApiResponse.error(res, `ids[${i}] is not a valid ObjectId`, 400);
      }
    }
    if (ids.length > 500) {
      return ApiResponse.error(res, 'Too many ids in one batch (max 500)', 413);
    }

    // Owner-safe delete: $in combined with userId prevents deleting
    // someone else's annotations even if a caller manages to forge an id.
    const result = await Annotation.deleteMany({
      _id: { $in: ids },
      userId: req.user.id
    });

    return ApiResponse.success(
      res,
      { deletedCount: result.deletedCount || 0 },
      'Bulk delete complete'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Upsert reading state (lastPage + optional bookmark) for a (user,book,chapter)
 * @route   POST /api/books/reading-state
 * @access  Private
 */
exports.upsertReadingState = async (req, res, next) => {
  try {
    const { bookId, chapterId, lastPage, bookmark } = req.body;
    if (!bookId) return ApiResponse.error(res, 'bookId is required', 400);
    if (!chapterId) return ApiResponse.error(res, 'chapterId is required', 400);
    if (!isValidObjectId(bookId) || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Invalid book or chapter id', 400);
    }

    const update = { lastReadAt: new Date() };
    if (typeof lastPage === 'number' && lastPage > 0) {
      update.lastPage = lastPage;
    }

    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    let state;
    if (bookmark && typeof bookmark.pageNumber === 'number' && bookmark.pageNumber > 0) {
      const bookmarkDoc = {
        pageNumber: bookmark.pageNumber,
        label: (bookmark.label || '').trim(),
        createdAt: new Date()
      };
      state = await ReadingState.findOneAndUpdate(
        { userId: req.user.id, bookId, chapterId },
        {
          $set: update,
          $setOnInsert: { userId: req.user.id, bookId, chapterId },
          $push: { bookmarks: bookmarkDoc }
        },
        options
      );
    } else {
      state = await ReadingState.findOneAndUpdate(
        { userId: req.user.id, bookId, chapterId },
        {
          $set: update,
          $setOnInsert: { userId: req.user.id, bookId, chapterId }
        },
        options
      );
    }

    return ApiResponse.success(res, state, 'Reading state updated');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get reading state for a (book, chapter)
 * @route   GET /api/books/reading-state?bookId=...&chapterId=...
 * @access  Private
 */
exports.getReadingState = async (req, res, next) => {
  try {
    const { bookId, chapterId } = req.query;
    if (!bookId) return ApiResponse.error(res, 'bookId is required', 400);
    if (!chapterId) return ApiResponse.error(res, 'chapterId is required', 400);
    if (!isValidObjectId(bookId) || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Invalid book or chapter id', 400);
    }

    const state = await ReadingState.findOne({
      userId: req.user.id,
      bookId,
      chapterId
    }).lean();

    return ApiResponse.success(res, state || null, 'Reading state fetched');
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Remove a bookmark by its subdoc id
 * @route   DELETE /api/books/reading-state/bookmark/:id?bookId=...&chapterId=...
 * @access  Private
 */
exports.removeBookmark = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return ApiResponse.error(res, 'Bookmark not found', 404);
    }
    const { bookId, chapterId } = req.query;
    if (!bookId) return ApiResponse.error(res, 'bookId is required', 400);
    if (!chapterId) return ApiResponse.error(res, 'chapterId is required', 400);
    if (!isValidObjectId(bookId) || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Invalid book or chapter id', 400);
    }

    const state = await ReadingState.findOneAndUpdate(
      { userId: req.user.id, bookId, chapterId },
      { $pull: { bookmarks: { _id: req.params.id } } },
      { new: true }
    );

    if (!state) {
      return ApiResponse.error(res, 'Reading state not found', 404);
    }
    return ApiResponse.success(res, state, 'Bookmark removed');
  } catch (err) {
    next(err);
  }
};
