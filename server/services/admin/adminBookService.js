const mongoose = require('mongoose');
const Book = require('../../models/Book');
const BookKnowledge = require('../../models/BookKnowledge');
const { createAdminAuditLog } = require('./adminAuditService');

function normalizeApprovalStatus(book) {
  return ['pending', 'approved', 'rejected'].includes(book?.approvalStatus)
    ? book.approvalStatus
    : 'approved';
}

function isLegacyApproved(book) {
  return !book?.approvalStatus;
}

function formatBookSummary(book, knowledge) {
  const totalPages = (book.chapters || []).reduce((sum, chapter) => sum + (Number(chapter.pageCount) || 0), 0);
  const firstChapter = (book.chapters || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))[0] || null;

  return {
    id: String(book._id),
    title: book.title || '',
    description: book.description || '',
    category: book.category || '',
    group: book.group || '',
    subject: book.subject || '',
    paper: book.paper || '',
    uploadedBy: book.uploadedBy
      ? {
          id: String(book.uploadedBy._id || ''),
          name: book.uploadedBy.name || '',
          email: book.uploadedBy.email || '',
          avatar: book.uploadedBy.avatar || ''
        }
      : null,
    createdAt: book.createdAt || null,
    isPublished: book.isPublished !== false,
    approvalStatus: normalizeApprovalStatus(book),
    isLegacyApproved: isLegacyApproved(book),
    rejectionReason: book.rejectionReason || '',
    reviewedAt: book.reviewedAt || null,
    chapterCount: (book.chapters || []).length,
    totalPages,
    previewChapterId: firstChapter ? String(firstChapter._id) : '',
    previewUrl: firstChapter?.fileUrl || '',
    previewApiUrl: firstChapter ? `/api/books/${book._id}/chapters/${firstChapter._id}/pdf` : '',
    ragStatus: knowledge?.status || 'pending',
    ragMessage: knowledge?.message || '',
    vectorIndexStatus: knowledge?.vectorIndexStatus || 'not_started'
  };
}

async function findBookOrThrow(bookId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    const err = new Error('Book not found');
    err.statusCode = 404;
    throw err;
  }

  const book = await Book.findById(bookId).populate('uploadedBy', 'name email avatar role');
  if (!book) {
    const err = new Error('Book not found');
    err.statusCode = 404;
    throw err;
  }

  return book;
}

async function listBooksForApproval({ search = '', status = '', category = '', ragStatus = '', page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

  const match = {};
  if (category) {
    match.category = category;
  }
  if (status === 'approved') {
    match.$or = [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }, { approvalStatus: null }];
  } else if (['pending', 'rejected'].includes(status)) {
    match.approvalStatus = status;
  }
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    match.$and = [
      ...(match.$and || []),
      {
        $or: [
          { title: regex },
          { description: regex },
          { subject: regex },
          { category: regex },
          { group: regex }
        ]
      }
    ];
  }

  const books = await Book.find(match)
    .populate('uploadedBy', 'name email avatar')
    .sort({ createdAt: -1 })
    .lean();

  const knowledgeDocs = await BookKnowledge.find({ bookId: { $in: books.map((book) => book._id) } })
    .select('bookId status message vectorIndexStatus')
    .lean();
  const knowledgeMap = new Map(knowledgeDocs.map((doc) => [String(doc.bookId), doc]));

  let items = books
    .map((book) => formatBookSummary(book, knowledgeMap.get(String(book._id))))
    .filter((item) => {
      if (!search.trim()) return true;
      const query = search.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(query)
        || item.subject.toLowerCase().includes(query)
        || item.category.toLowerCase().includes(query)
        || item.group.toLowerCase().includes(query)
        || item.uploadedBy?.name?.toLowerCase().includes(query)
        || item.uploadedBy?.email?.toLowerCase().includes(query)
      );
    });

  if (ragStatus) {
    items = items.filter((item) => item.ragStatus === ragStatus);
  }

  const total = items.length;
  const paginatedItems = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return {
    items: paginatedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    stats: {
      pending: items.filter((item) => item.approvalStatus === 'pending').length,
      approved: items.filter((item) => item.approvalStatus === 'approved').length,
      rejected: items.filter((item) => item.approvalStatus === 'rejected').length
    }
  };
}

async function getBookApprovalDetails(bookId) {
  const book = await findBookOrThrow(bookId);
  const knowledge = await BookKnowledge.findOne({ bookId: book._id })
    .select('status message vectorIndexStatus totalPages extractedPages emptyPages totalChunks embeddedChunks sourcePages completedAt startedAt lastProcessingError')
    .lean();

  return {
    ...formatBookSummary(book.toObject(), knowledge),
    chapters: (book.chapters || [])
      .map((chapter) => ({
        id: String(chapter._id),
        title: chapter.title || '',
        order: Number(chapter.order) || 0,
        fileSize: Number(chapter.fileSize) || 0,
        pageCount: Number(chapter.pageCount) || 0,
        createdAt: chapter.createdAt || null,
        previewUrl: chapter.fileUrl || '',
        previewApiUrl: `/api/books/${book._id}/chapters/${chapter._id}/pdf`
      }))
      .sort((a, b) => a.order - b.order),
    review: {
      status: normalizeApprovalStatus(book),
      rejectionReason: book.rejectionReason || '',
      reviewedAt: book.reviewedAt || null
    },
    rag: {
      status: knowledge?.status || 'pending',
      message: knowledge?.message || '',
      vectorIndexStatus: knowledge?.vectorIndexStatus || 'not_started',
      totalPages: knowledge?.totalPages || 0,
      extractedPages: knowledge?.extractedPages || 0,
      emptyPages: knowledge?.emptyPages || 0,
      totalChunks: knowledge?.totalChunks || 0,
      embeddedChunks: knowledge?.embeddedChunks || 0,
      sourcePages: knowledge?.sourcePages || 0,
      startedAt: knowledge?.startedAt || null,
      completedAt: knowledge?.completedAt || null,
      lastProcessingError: knowledge?.lastProcessingError || ''
    }
  };
}

async function approveBook({ adminUser, bookId, reason = '' }) {
  const book = await findBookOrThrow(bookId);
  const previousStatus = normalizeApprovalStatus(book);
  const previousReason = book.rejectionReason || '';

  book.approvalStatus = 'approved';
  book.rejectionReason = '';
  book.reviewedBy = adminUser.id;
  book.reviewedAt = new Date();
  book.isPublished = true;
  await book.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'BOOK_APPROVED',
    targetEntityId: String(book._id),
    targetEntityType: 'book',
    targetEntityName: book.title,
    previousValue: {
      approvalStatus: previousStatus,
      rejectionReason: previousStatus === 'rejected' ? previousReason : ''
    },
    newValue: {
      approvalStatus: 'approved',
      isPublished: book.isPublished
    },
    reason
  });

  return getBookApprovalDetails(bookId);
}

async function rejectBook({ adminUser, bookId, reason }) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Rejection reason is required');
    err.statusCode = 400;
    throw err;
  }

  const book = await findBookOrThrow(bookId);
  const previousStatus = normalizeApprovalStatus(book);
  const previousReason = book.rejectionReason || '';

  book.approvalStatus = 'rejected';
  book.rejectionReason = trimmedReason;
  book.reviewedBy = adminUser.id;
  book.reviewedAt = new Date();
  await book.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'BOOK_REJECTED',
    targetEntityId: String(book._id),
    targetEntityType: 'book',
    targetEntityName: book.title,
    previousValue: {
      approvalStatus: previousStatus,
      rejectionReason: previousReason
    },
    newValue: {
      approvalStatus: 'rejected',
      rejectionReason: trimmedReason
    },
    reason: trimmedReason
  });

  return getBookApprovalDetails(bookId);
}

module.exports = {
  listBooksForApproval,
  getBookApprovalDetails,
  approveBook,
  rejectBook
};
