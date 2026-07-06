const mongoose = require('mongoose');
const IeltsListeningSet = require('../../models/IeltsListeningSet');
const IeltsWritingSet = require('../../models/IeltsWritingSet');
const { createAdminAuditLog } = require('./adminAuditService');

const SUPPORTED_TYPES = ['listening', 'writing'];
const MODEL_BY_TYPE = {
  listening: IeltsListeningSet,
  writing: IeltsWritingSet
};

function normalizeStatus(doc) {
  return ['pending', 'approved', 'rejected'].includes(doc?.approvalStatus)
    ? doc.approvalStatus
    : 'approved';
}

function getTypeLabel(type) {
  return type === 'listening' ? 'IELTS Listening' : 'IELTS Writing';
}

function serializeSet(type, doc) {
  const raw = doc.toObject ? doc.toObject() : doc;
  const status = normalizeStatus(raw);
  return {
    id: String(raw._id),
    setType: type,
    setTypeLabel: getTypeLabel(type),
    title: raw.setName || '',
    createdAt: raw.createdAt || null,
    status,
    rejectionReason: raw.rejectionReason || '',
    reviewedAt: raw.reviewedAt || null,
    uploader: raw.creator
      ? {
          id: String(raw.creator._id || ''),
          name: raw.creator.name || '',
          email: raw.creator.email || ''
        }
      : null,
    sectionCount: Array.isArray(raw.sections) ? raw.sections.length : 0,
    taskTypes: raw.task1 || raw.task2
      ? [raw.task1?.type, raw.task2?.type].filter(Boolean)
      : [],
    detail: type === 'listening'
      ? {
          sections: (raw.sections || []).map((section) => ({
            sectionNumber: section.sectionNumber,
            audioUrl: section.audioUrl || '',
            pdfUrl: section.pdfUrl || ''
          }))
        }
      : {
          task1: raw.task1 || null,
          task2: raw.task2 || null
        }
  };
}

async function listIeltsSets({ search = '', status = '', type = '', page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const query = {};

  if (status === 'approved') {
    query.$or = [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }, { approvalStatus: null }];
  } else if (['pending', 'rejected'].includes(status)) {
    query.approvalStatus = status;
  }
  if (search.trim()) {
    query.setName = new RegExp(search.trim(), 'i');
  }

  const typesToLoad = SUPPORTED_TYPES.includes(type) ? [type] : SUPPORTED_TYPES;
  const results = await Promise.all(typesToLoad.map(async (setType) => {
    const Model = MODEL_BY_TYPE[setType];
    const docs = await Model.find(query)
      .populate('creator', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => serializeSet(setType, doc));
  }));

  const items = results.flat().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const total = items.length;
  const paginated = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return {
    items: paginated,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    supportedTypes: SUPPORTED_TYPES,
    unsupportedTypes: ['reading', 'speaking']
  };
}

async function getIeltsSetDetails(setType, setId) {
  if (!SUPPORTED_TYPES.includes(setType)) {
    const err = new Error('This IELTS set type is not modeled in the current project');
    err.statusCode = 400;
    throw err;
  }
  if (!mongoose.Types.ObjectId.isValid(setId)) {
    const err = new Error('IELTS set not found');
    err.statusCode = 404;
    throw err;
  }

  const Model = MODEL_BY_TYPE[setType];
  const doc = await Model.findById(setId).populate('creator', 'name email');
  if (!doc) {
    const err = new Error('IELTS set not found');
    err.statusCode = 404;
    throw err;
  }
  return serializeSet(setType, doc);
}

async function approveIeltsSet({ adminUser, setType, setId, reason = '' }) {
  if (!SUPPORTED_TYPES.includes(setType)) {
    const err = new Error('This IELTS set type is not modeled in the current project');
    err.statusCode = 400;
    throw err;
  }
  const Model = MODEL_BY_TYPE[setType];
  const doc = await Model.findById(setId).populate('creator', 'name email');
  if (!doc) {
    const err = new Error('IELTS set not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = normalizeStatus(doc);
  const previousReason = doc.rejectionReason || '';
  doc.approvalStatus = 'approved';
  doc.rejectionReason = '';
  doc.reviewedBy = adminUser.id;
  doc.reviewedAt = new Date();
  await doc.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'IELTS_SET_APPROVED',
    targetEntityId: String(doc._id),
    targetEntityType: `ielts_${setType}_set`,
    targetEntityName: doc.setName || getTypeLabel(setType),
    previousValue: {
      status: previousStatus,
      rejectionReason: previousReason
    },
    newValue: {
      status: 'approved'
    },
    reason
  });

  return serializeSet(setType, doc);
}

async function rejectIeltsSet({ adminUser, setType, setId, reason }) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Rejection reason is required');
    err.statusCode = 400;
    throw err;
  }
  if (!SUPPORTED_TYPES.includes(setType)) {
    const err = new Error('This IELTS set type is not modeled in the current project');
    err.statusCode = 400;
    throw err;
  }
  const Model = MODEL_BY_TYPE[setType];
  const doc = await Model.findById(setId).populate('creator', 'name email');
  if (!doc) {
    const err = new Error('IELTS set not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = normalizeStatus(doc);
  const previousReason = doc.rejectionReason || '';
  doc.approvalStatus = 'rejected';
  doc.rejectionReason = trimmedReason;
  doc.reviewedBy = adminUser.id;
  doc.reviewedAt = new Date();
  await doc.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'IELTS_SET_REJECTED',
    targetEntityId: String(doc._id),
    targetEntityType: `ielts_${setType}_set`,
    targetEntityName: doc.setName || getTypeLabel(setType),
    previousValue: {
      status: previousStatus,
      rejectionReason: previousReason
    },
    newValue: {
      status: 'rejected',
      rejectionReason: trimmedReason
    },
    reason: trimmedReason
  });

  return serializeSet(setType, doc);
}

module.exports = {
  listIeltsSets,
  getIeltsSetDetails,
  approveIeltsSet,
  rejectIeltsSet
};
