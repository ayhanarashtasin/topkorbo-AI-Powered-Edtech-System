const mongoose = require('mongoose');
const AdminNotice = require('../../models/AdminNotice');
const { createAdminAuditLog } = require('./adminAuditService');

const NOTICE_TYPES = ['info', 'success', 'warning', 'danger'];
const NOTICE_AUDIENCES = ['all', 'students', 'teachers'];
const NOTICE_LOCATIONS = ['homepage', 'student_dashboard', 'teacher_dashboard', 'all_dashboards'];

function serializeNotice(notice) {
  const raw = notice.toObject ? notice.toObject() : notice;
  return {
    id: String(raw._id),
    title: raw.title || '',
    message: raw.message || '',
    type: raw.type || 'info',
    audience: raw.audience || 'all',
    location: raw.location || '',
    startsAt: raw.startsAt || null,
    endsAt: raw.endsAt || null,
    status: raw.status || 'active',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    archivedAt: raw.archivedAt || null,
    createdBy: raw.createdBy
      ? {
          id: String(raw.createdBy._id || ''),
          name: raw.createdBy.name || '',
          email: raw.createdBy.email || ''
        }
      : null,
    updatedBy: raw.updatedBy
      ? {
          id: String(raw.updatedBy._id || ''),
          name: raw.updatedBy.name || '',
          email: raw.updatedBy.email || ''
        }
      : null
  };
}

function validateNoticePayload(payload = {}, { partial = false, currentValues = {} } = {}) {
  const next = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'title')) {
    const title = String(payload.title || '').trim();
    if (!title) {
      const err = new Error('Notice title is required');
      err.statusCode = 400;
      throw err;
    }
    next.title = title;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'message')) {
    const message = String(payload.message || '').trim();
    if (!message) {
      const err = new Error('Notice message is required');
      err.statusCode = 400;
      throw err;
    }
    next.message = message;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'type')) {
    const type = String(payload.type || 'info');
    if (!NOTICE_TYPES.includes(type)) {
      const err = new Error('Invalid notice type');
      err.statusCode = 400;
      throw err;
    }
    next.type = type;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'audience')) {
    const audience = String(payload.audience || 'all');
    if (!NOTICE_AUDIENCES.includes(audience)) {
      const err = new Error('Invalid notice audience');
      err.statusCode = 400;
      throw err;
    }
    next.audience = audience;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'location')) {
    const location = String(payload.location || '');
    if (!NOTICE_LOCATIONS.includes(location)) {
      const err = new Error('Invalid notice location');
      err.statusCode = 400;
      throw err;
    }
    next.location = location;
  }

  const startsAt = Object.prototype.hasOwnProperty.call(payload, 'startsAt') ? (payload.startsAt ? new Date(payload.startsAt) : null) : undefined;
  const endsAt = Object.prototype.hasOwnProperty.call(payload, 'endsAt') ? (payload.endsAt ? new Date(payload.endsAt) : null) : undefined;

  if (startsAt !== undefined && startsAt && Number.isNaN(startsAt.getTime())) {
    const err = new Error('Invalid notice start date');
    err.statusCode = 400;
    throw err;
  }
  if (endsAt !== undefined && endsAt && Number.isNaN(endsAt.getTime())) {
    const err = new Error('Invalid notice end date');
    err.statusCode = 400;
    throw err;
  }

  const effectiveStart = startsAt !== undefined ? startsAt : (currentValues.startsAt ?? null);
  const effectiveEnd = endsAt !== undefined ? endsAt : (currentValues.endsAt ?? null);
  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    const err = new Error('End date cannot be earlier than start date');
    err.statusCode = 400;
    throw err;
  }

  if (startsAt !== undefined) next.startsAt = startsAt;
  if (endsAt !== undefined) next.endsAt = endsAt;

  return next;
}

async function listNotices({ search = '', status = '', location = '', audience = '', page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const query = {};

  if (status) query.status = status;
  if (location) query.location = location;
  if (audience) query.audience = audience;
  if (search.trim()) {
    query.$or = [
      { title: new RegExp(search.trim(), 'i') },
      { message: new RegExp(search.trim(), 'i') }
    ];
  }

  const [items, total] = await Promise.all([
    AdminNotice.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AdminNotice.countDocuments(query)
  ]);

  return {
    items: items.map(serializeNotice),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function createNotice({ adminUser, payload }) {
  const values = validateNoticePayload(payload, { partial: false });
  const notice = await AdminNotice.create({
    ...values,
    createdBy: adminUser.id,
    updatedBy: adminUser.id
  });

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'NOTICE_CREATED',
    targetEntityId: String(notice._id),
    targetEntityType: 'notice',
    targetEntityName: notice.title,
    previousValue: null,
    newValue: {
      title: notice.title,
      status: notice.status,
      location: notice.location,
      audience: notice.audience
    }
  });

  return serializeNotice(notice);
}

async function updateNotice({ adminUser, noticeId, payload }) {
  if (!mongoose.Types.ObjectId.isValid(noticeId)) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }
  const notice = await AdminNotice.findById(noticeId);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    title: notice.title,
    message: notice.message,
    type: notice.type,
    audience: notice.audience,
    location: notice.location,
    startsAt: notice.startsAt,
    endsAt: notice.endsAt,
    status: notice.status
  };
  const nextValues = validateNoticePayload(payload, {
    partial: true,
    currentValues: {
      startsAt: notice.startsAt,
      endsAt: notice.endsAt
    }
  });
  Object.assign(notice, nextValues);
  notice.updatedBy = adminUser.id;
  await notice.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'NOTICE_UPDATED',
    targetEntityId: String(notice._id),
    targetEntityType: 'notice',
    targetEntityName: notice.title,
    previousValue,
    newValue: {
      title: notice.title,
      message: notice.message,
      type: notice.type,
      audience: notice.audience,
      location: notice.location,
      startsAt: notice.startsAt,
      endsAt: notice.endsAt,
      status: notice.status
    }
  });

  return serializeNotice(notice);
}

async function archiveNotice({ adminUser, noticeId }) {
  if (!mongoose.Types.ObjectId.isValid(noticeId)) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }
  const notice = await AdminNotice.findById(noticeId);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    status: notice.status,
    title: notice.title
  };
  notice.status = 'archived';
  notice.archivedBy = adminUser.id;
  notice.archivedAt = new Date();
  notice.updatedBy = adminUser.id;
  await notice.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'NOTICE_ARCHIVED',
    targetEntityId: String(notice._id),
    targetEntityType: 'notice',
    targetEntityName: notice.title,
    previousValue,
    newValue: {
      status: notice.status,
      archivedAt: notice.archivedAt
    }
  });

  return serializeNotice(notice);
}

module.exports = {
  listNotices,
  createNotice,
  updateNotice,
  archiveNotice
};
