const { bucket } = require('../config/firebase');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Annotation = require('../models/Annotation');
const ReadingState = require('../models/ReadingState');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

const VALID_CATEGORIES = ['Academic', 'Admission'];
const VALID_GROUPS = ['Science', 'Arts', 'Commerce', 'HSC', 'Engineering', 'Medical', 'Varsity'];
const VALID_PAPERS = ['1st', '2nd', 'N/A'];
const VALID_ANNOTATION_TYPES = ['pen'];

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
    blobStream.end(file.buffer);
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
      
      return ApiResponse.error(res, 'Only teachers can upload books', 403);
    }

    const {
      title, description, category, group, subject, paper, isPublished,
      chapterNumber, chapterTitle, firstChapterTitle, firstChapterNumber
    } = req.body;

    if (!title || !title.trim()) {
      
      return ApiResponse.error(res, 'Title is required', 400);
    }
    if (!VALID_CATEGORIES.includes(category)) {
      
      return ApiResponse.error(res, 'Invalid category', 400);
    }
    if (!VALID_GROUPS.includes(group)) {
      
      return ApiResponse.error(res, 'Invalid group', 400);
    }
    if (!subject || !subject.trim()) {
      
      return ApiResponse.error(res, 'Subject is required', 400);
    }
    if (!VALID_PAPERS.includes(paper)) {
      
      return ApiResponse.error(res, 'Invalid paper', 400);
    }
    if (!req.file) {
      return ApiResponse.error(res, 'PDF file is required (chapter 1)', 400);
    }

    const numRaw = chapterNumber || firstChapterNumber;
    const chNum = parseInt(numRaw, 10);
    const orderVal = !isNaN(chNum) ? chNum - 1 : 0;
    const chTitle = (chapterTitle || firstChapterTitle || '').trim() || 'Chapter 1';

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
        fileUrl: await uploadFileToFirebase(req.file, user._id),
        fileSize: req.file.size,
        pageCount: 0
      }]
    });

    return ApiResponse.success(res, book, 'Book created successfully', 201);
  } catch (err) {
    // Clean up uploaded file on error
    
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
      
      return ApiResponse.error(res, 'Only teachers can add chapters', 403);
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      
      return ApiResponse.error(res, 'Book not found', 404);
    }
    if (book.uploadedBy.toString() !== user._id.toString()) {
      
      return ApiResponse.error(res, 'You can only add chapters to your own books', 403);
    }

    const { title } = req.body;
    if (!title || !title.trim()) {
      
      return ApiResponse.error(res, 'Chapter title is required', 400);
    }
    if (!req.file) {
      return ApiResponse.error(res, 'PDF file is required', 400);
    }

    const newChapter = {
      title: title.trim(),
      order: book.chapters.length,
      fileUrl: await uploadFileToFirebase(req.file, user._id),
      fileSize: req.file.size,
      pageCount: 0
    };
    book.chapters.push(newChapter);
    await book.save();

    return ApiResponse.success(res, book, 'Chapter added successfully', 201);
  } catch (err) {
    
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
    // Strip fileUrl from chapter list returned here
    const safeChapters = (book.chapters || []).map((c) => ({
      _id: c._id,
      title: c.title,
      order: c.order,
      pageCount: c.pageCount,
      fileSize: c.fileSize,
      createdAt: c.createdAt
    }));
    return ApiResponse.success(res, { ...book, chapters: safeChapters }, 'Book detail fetched');
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
    const chapter = book.chapters[0];
    return ApiResponse.success(res, { chapter }, 'Chapter metadata fetched');
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
 * Validate a single annotation payload and build the Mongoose doc that
 * can be passed to `Annotation.create` or `Annotation.insertMany`.
 * Returns `{ doc }` on success or `{ error }` on failure. The caller
 * picks the right error message format.
 */
function buildAnnotationDoc(a, ctx) {
  if (!a || a.type !== 'pen') {
    return { error: 'type must be pen' };
  }
  if (!Array.isArray(a.points) || a.points.length < 1) {
    return { error: 'pen annotations need at least 1 point' };
  }
  const doc = {
    userId: ctx.userId,
    bookId: ctx.bookId,
    chapterId: ctx.chapterId,
    pageNumber: ctx.pageNumber,
    type: 'pen',
    color: a.color || '#EF4444',
    strokeWidth: a.strokeWidth || 3,
    points: a.points.map((p) => {
      const out = { x: Number(p.x), y: Number(p.y) };
      if (p.w !== undefined && p.w !== null) {
        const w = Number(p.w);
        if (Number.isFinite(w) && w > 0) out.w = w;
      }
      if (p.p !== undefined && p.p !== null) {
        const pr = Number(p.p);
        if (Number.isFinite(pr) && pr >= 0 && pr <= 1) out.p = pr;
      }
      return out;
    })
  };
  return { doc };
}

/**
 * @desc    Create an annotation (pen)
 * @route   POST /api/books/annotations
 * @access  Private
 */
exports.createAnnotation = async (req, res, next) => {
  try {
    const {
      chapterId, pageNumber, type, color,
      points, strokeWidth
    } = req.body;

    if (!chapterId) return ApiResponse.error(res, 'chapterId is required', 400);
    if (!isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Chapter not found', 404);
    }
    if (!pageNumber || pageNumber < 1) return ApiResponse.error(res, 'Valid pageNumber is required', 400);

    // Verify the chapter exists
    const book = await Book.findOne({ 'chapters._id': chapterId }).select('_id').lean();
    if (!book) {
      return ApiResponse.error(res, 'Chapter not found', 404);
    }

    const { doc, error } = buildAnnotationDoc(
      { type, color, points, strokeWidth },
      { userId: req.user.id, bookId: book._id, chapterId, pageNumber }
    );
    if (error) return ApiResponse.error(res, error, 400);

    const annotation = await Annotation.create(doc);
    return ApiResponse.success(res, annotation, 'Annotation saved', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List user's annotations for a chapter (optional page filter)
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
    const match = { userId: req.user.id, chapterId };
    if (page) {
      const pageNum = parseInt(page);
      if (!isNaN(pageNum) && pageNum > 0) {
        match.pageNumber = pageNum;
      }
    }
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
    const annotation = await Annotation.findById(req.params.id);
    if (!annotation) {
      return ApiResponse.error(res, 'Annotation not found', 404);
    }
    if (annotation.userId.toString() !== req.user.id) {
      return ApiResponse.error(res, 'You can only delete your own annotations', 403);
    }
    await annotation.deleteOne();
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

    if (!chapterId || !isValidObjectId(chapterId)) {
      return ApiResponse.error(res, 'Valid chapterId is required', 400);
    }
    if (!pageNumber || pageNumber < 1) {
      return ApiResponse.error(res, 'Valid pageNumber is required', 400);
    }
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return ApiResponse.error(res, 'annotations[] is required and must not be empty', 400);
    }
    if (annotations.length > 500) {
      // Sanity cap. A full page of dense drawing is well under 500 strokes.
      return ApiResponse.error(res, 'Too many annotations in one batch (max 500)', 413);
    }

    // Verify the chapter exists. We also need the parent bookId to record on
    // each row (even though the existing single endpoint also derives it).
    let resolvedBookId = bookId;
    if (!resolvedBookId || !isValidObjectId(resolvedBookId)) {
      const book = await Book.findOne({ 'chapters._id': chapterId }).select('_id').lean();
      if (!book) return ApiResponse.error(res, 'Chapter not found', 404);
      resolvedBookId = book._id.toString();
    } else {
      const book = await Book.findOne({ _id: resolvedBookId, 'chapters._id': chapterId }).select('_id').lean();
      if (!book) return ApiResponse.error(res, 'Chapter not found', 404);
    }

    // Build the docs with the same validation the single endpoint uses.
    const docs = [];
    const ctx = { userId: req.user.id, bookId: resolvedBookId, chapterId, pageNumber };
    for (let i = 0; i < annotations.length; i += 1) {
      const { doc, error } = buildAnnotationDoc(annotations[i], ctx);
      if (error) {
        return ApiResponse.error(res, `annotations[${i}]: ${error}`, 400);
      }
      docs.push(doc);
    }

    // insertMany does not accept `lean` (that's a query option). To
    // return plain objects we map with `.toObject()` after the insert.
    // Mongoose also respects the schema's `pre('save')` updatedAt hook
    // for individual saves; for insertMany we stamp updatedAt
    // explicitly so the response carries the canonical timestamp.
    const now = new Date();
    docs.forEach((d) => { d.updatedAt = now; d.createdAt = now; });
    const inserted = await Annotation.insertMany(docs);
    const insertedPlain = inserted.map((d) => d.toObject());

    return ApiResponse.success(
      res,
      { annotations: insertedPlain, insertedCount: insertedPlain.length },
      `Saved ${insertedPlain.length} annotation${insertedPlain.length === 1 ? '' : 's'}`,
      201
    );
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
