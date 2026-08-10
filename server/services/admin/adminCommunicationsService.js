const AdminBroadcast = require('../../models/AdminBroadcast');
const FeedbackEntry = require('../../models/FeedbackEntry');
const Notification = require('../../models/Notification');
const SupportTicket = require('../../models/SupportTicket');
const User = require('../../models/User');
const { getIO } = require('../../socket');
const { createAdminAuditLog } = require('./adminAuditService');

const BROADCAST_AUDIENCES = ['all', 'students', 'teachers', 'tutors', 'moderators'];
const BROADCAST_PRIORITIES = ['normal', 'important', 'urgent'];
const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const SUPPORT_CATEGORIES = ['account', 'technical', 'billing', 'content', 'contest', 'ielts', 'general'];
const FEEDBACK_STATUSES = ['new', 'reviewed', 'dismissed', 'resolved'];
const FEEDBACK_ITEM_TYPES = ['question', 'book', 'contest', 'ielts_set', 'platform'];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatPreview(text = '', fallback = 'Not provided') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function buildAudienceQuery(audience) {
  const baseQuery = {
    $or: [
      { accountStatus: 'active' },
      { accountStatus: { $exists: false }, isBanned: { $ne: true } }
    ]
  };

  if (audience === 'students') {
    return { ...baseQuery, role: 'student' };
  }
  if (audience === 'teachers') {
    return { ...baseQuery, role: 'teacher' };
  }
  if (audience === 'tutors') {
    return { ...baseQuery, role: 'tutor' };
  }
  if (audience === 'moderators') {
    return { ...baseQuery, forumRole: 'moderator' };
  }

  return baseQuery;
}

async function getNotificationAudienceStats() {
  const activeBase = {
    $or: [
      { accountStatus: 'active' },
      { accountStatus: { $exists: false }, isBanned: { $ne: true } }
    ]
  };

  const [allUsers, students, teachers, tutors, moderators] = await Promise.all([
    User.countDocuments(activeBase),
    User.countDocuments({ ...activeBase, role: 'student' }),
    User.countDocuments({ ...activeBase, role: 'teacher' }),
    User.countDocuments({ ...activeBase, role: 'tutor' }),
    User.countDocuments({ ...activeBase, forumRole: 'moderator' })
  ]);

  return {
    all: allUsers,
    students,
    teachers,
    tutors,
    moderators,
    configuredChannels: {
      inApp: true,
      email: false,
      sms: false,
      push: false
    }
  };
}

async function listBroadcasts({ page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  const [items, total, audienceStats] = await Promise.all([
    AdminBroadcast.find({})
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AdminBroadcast.countDocuments({}),
    getNotificationAudienceStats()
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      title: item.title || '',
      message: item.message || '',
      audience: item.audience || 'all',
      priority: item.priority || 'normal',
      channels: {
        inApp: !!item.channels?.inApp,
        email: !!item.channels?.email,
        sms: !!item.channels?.sms,
        push: !!item.channels?.push
      },
      status: item.status || 'sent',
      sentCount: item.sentCount || 0,
      failedCount: item.failedCount || 0,
      scheduledFor: item.scheduledFor || null,
      createdAt: item.createdAt || null,
      createdBy: item.createdBy
        ? {
            id: String(item.createdBy._id),
            name: item.createdBy.name || '',
            email: item.createdBy.email || ''
          }
        : null
    })),
    stats: audienceStats,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function createBroadcast({
  adminUser,
  title,
  message,
  audience,
  priority = 'normal',
  channels = {},
  scheduledFor = null
}) {
  const trimmedTitle = String(title || '').trim();
  const trimmedMessage = String(message || '').trim();

  if (!trimmedTitle) {
    const err = new Error('Broadcast title is required');
    err.statusCode = 400;
    throw err;
  }
  if (!trimmedMessage) {
    const err = new Error('Broadcast message is required');
    err.statusCode = 400;
    throw err;
  }
  if (!BROADCAST_AUDIENCES.includes(audience)) {
    const err = new Error('Invalid audience');
    err.statusCode = 400;
    throw err;
  }
  if (!BROADCAST_PRIORITIES.includes(priority)) {
    const err = new Error('Invalid priority');
    err.statusCode = 400;
    throw err;
  }

  const normalizedChannels = {
    inApp: channels?.inApp !== false,
    email: false,
    sms: false,
    push: false
  };

  if (!normalizedChannels.inApp) {
    const err = new Error('In-app notification delivery must remain enabled because other channels are not configured');
    err.statusCode = 400;
    throw err;
  }

  const existingRecent = await AdminBroadcast.findOne({
    createdBy: adminUser.id,
    title: trimmedTitle,
    message: trimmedMessage,
    audience,
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
  }).lean();

  if (existingRecent) {
    const err = new Error('A matching broadcast was already sent recently. Please avoid duplicates.');
    err.statusCode = 409;
    throw err;
  }

  const recipients = await User.find(buildAudienceQuery(audience))
    .select('_id')
    .lean();
  const recipientIds = recipients.map((item) => item._id).filter(Boolean);

  const broadcast = await AdminBroadcast.create({
    title: trimmedTitle,
    message: trimmedMessage,
    audience,
    priority,
    channels: normalizedChannels,
    status: scheduledFor ? 'scheduled' : 'sent',
    scheduledFor: scheduledFor || null,
    createdBy: adminUser.id
  });

  if (scheduledFor) {
    await createAdminAuditLog({
      adminId: adminUser.id,
      targetEntityId: broadcast._id,
      targetEntityType: 'broadcast',
      targetEntityName: trimmedTitle,
      actionType: 'BROADCAST_SENT',
      previousValue: { status: 'draft' },
      newValue: { status: 'scheduled', audience, scheduledFor },
      reason: 'Scheduled placeholder only'
    });
    return {
      id: String(broadcast._id),
      status: 'scheduled',
      sentCount: 0
    };
  }

  try {
    if (recipientIds.length) {
      const docs = recipientIds.map((recipientId) => ({
        recipient: recipientId,
        type: 'admin_update',
        message: trimmedTitle,
        preview: trimmedMessage
      }));
      const inserted = await Notification.insertMany(docs, { ordered: false });

      const io = getIO();
      if (io) {
        inserted.forEach((doc) => {
          io.to(`user:${String(doc.recipient)}`).emit('notification:new', doc);
        });
      }
    }

    broadcast.sentCount = recipientIds.length;
    broadcast.failedCount = 0;
    broadcast.status = 'sent';
    await broadcast.save();

    await createAdminAuditLog({
      adminId: adminUser.id,
      targetEntityId: broadcast._id,
      targetEntityType: 'broadcast',
      targetEntityName: trimmedTitle,
      actionType: 'BROADCAST_SENT',
      previousValue: { status: 'draft' },
      newValue: {
        status: 'sent',
        audience,
        sentCount: recipientIds.length,
        channels: normalizedChannels
      },
      reason: trimmedMessage.slice(0, 500)
    });

    return {
      id: String(broadcast._id),
      status: broadcast.status,
      sentCount: broadcast.sentCount
    };
  } catch (error) {
    broadcast.status = 'failed';
    broadcast.failedCount = recipientIds.length;
    await broadcast.save();

    await createAdminAuditLog({
      adminId: adminUser.id,
      targetEntityId: broadcast._id,
      targetEntityType: 'broadcast',
      targetEntityName: trimmedTitle,
      actionType: 'BROADCAST_FAILED',
      previousValue: { status: 'draft' },
      newValue: { status: 'failed', audience },
      reason: error.message
    });

    throw error;
  }
}

function buildSupportQuery({ search = '', status = '', priority = '', category = '', createdFrom = '', createdTo = '' }) {
  const query = {};

  if (status && SUPPORT_STATUSES.includes(status)) query.status = status;
  if (priority && SUPPORT_PRIORITIES.includes(priority)) query.priority = priority;
  if (category && SUPPORT_CATEGORIES.includes(category)) query.category = category;
  if (createdFrom || createdTo) {
    query.createdAt = {};
    if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
    if (createdTo) {
      const endDate = new Date(createdTo);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { title: regex },
      { message: regex }
    ];
  }

  return query;
}

async function listSupportTickets({
  search = '',
  status = '',
  priority = '',
  category = '',
  createdFrom = '',
  createdTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const query = buildSupportQuery({ search, status, priority, category, createdFrom, createdTo });

  const [items, total] = await Promise.all([
    SupportTicket.find(query)
      .populate('user', 'name email role forumRole')
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SupportTicket.countDocuments(query)
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      title: item.title || '',
      user: item.user
        ? {
            id: String(item.user._id),
            name: item.user.name || '',
            email: item.user.email || '',
            role: item.user.forumRole === 'moderator' ? 'moderator' : item.user.role || 'student'
          }
        : null,
      category: item.category || 'general',
      priority: item.priority || 'normal',
      status: item.status || 'open',
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || item.lastUpdatedAt || null
    })),
    summary: {
      total,
      open: await SupportTicket.countDocuments({ status: 'open' }),
      in_progress: await SupportTicket.countDocuments({ status: 'in_progress' }),
      resolved: await SupportTicket.countDocuments({ status: 'resolved' }),
      closed: await SupportTicket.countDocuments({ status: 'closed' })
    },
    filters: {
      statuses: SUPPORT_STATUSES,
      priorities: SUPPORT_PRIORITIES,
      categories: SUPPORT_CATEGORIES
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getSupportTicketDetails(ticketId) {
  const ticket = await SupportTicket.findById(ticketId)
    .populate('user', 'name email role forumRole')
    .populate('replies.author', 'name email')
    .populate('adminNotes.addedBy', 'name email')
    .lean();

  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: String(ticket._id),
    title: ticket.title || '',
    message: ticket.message || '',
    category: ticket.category || 'general',
    priority: ticket.priority || 'normal',
    status: ticket.status || 'open',
    createdAt: ticket.createdAt || null,
    updatedAt: ticket.updatedAt || ticket.lastUpdatedAt || null,
    user: ticket.user
      ? {
          id: String(ticket.user._id),
          name: ticket.user.name || '',
          email: ticket.user.email || '',
          role: ticket.user.forumRole === 'moderator' ? 'moderator' : ticket.user.role || 'student'
        }
      : null,
    replies: (ticket.replies || []).map((reply) => ({
      id: String(reply._id),
      message: reply.message || '',
      authorRole: reply.authorRole || 'user',
      createdAt: reply.createdAt || null,
      author: reply.author
        ? {
            id: String(reply.author._id),
            name: reply.author.name || '',
            email: reply.author.email || ''
          }
        : null
    })),
    adminNotes: (ticket.adminNotes || []).map((note) => ({
      note: note.note || '',
      addedAt: note.addedAt || null,
      addedBy: note.addedBy
        ? {
            id: String(note.addedBy._id),
            name: note.addedBy.name || '',
            email: note.addedBy.email || ''
          }
        : null
    }))
  };
}

async function updateSupportTicketStatus({ adminUser, ticketId, status, note = '' }) {
  if (!SUPPORT_STATUSES.includes(status)) {
    const err = new Error('Invalid support ticket status');
    err.statusCode = 400;
    throw err;
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = ticket.status;
  ticket.status = status;
  ticket.lastUpdatedAt = new Date();
  ticket.closedAt = status === 'closed' ? new Date() : null;
  if (note) {
    ticket.adminNotes.push({
      note: String(note).trim(),
      addedBy: adminUser.id,
      addedAt: new Date()
    });
  }
  await ticket.save();

  const actionType = status === 'resolved'
    ? 'SUPPORT_TICKET_RESOLVED'
    : status === 'closed'
      ? 'SUPPORT_TICKET_CLOSED'
      : 'SUPPORT_TICKET_UPDATED';

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: ticket.user || undefined,
    targetEntityId: ticket._id,
    targetEntityType: 'support_ticket',
    targetEntityName: ticket.title,
    actionType,
    previousValue: { status: previousStatus },
    newValue: { status },
    reason: String(note || '').trim()
  });

  return {
    id: String(ticket._id),
    status: ticket.status
  };
}

async function updateSupportTicketPriority({ adminUser, ticketId, priority, note = '' }) {
  if (!SUPPORT_PRIORITIES.includes(priority)) {
    const err = new Error('Invalid support ticket priority');
    err.statusCode = 400;
    throw err;
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  const previousPriority = ticket.priority;
  ticket.priority = priority;
  ticket.lastUpdatedAt = new Date();
  if (note) {
    ticket.adminNotes.push({
      note: String(note).trim(),
      addedBy: adminUser.id,
      addedAt: new Date()
    });
  }
  await ticket.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: ticket.user || undefined,
    targetEntityId: ticket._id,
    targetEntityType: 'support_ticket',
    targetEntityName: ticket.title,
    actionType: 'SUPPORT_TICKET_UPDATED',
    previousValue: { priority: previousPriority },
    newValue: { priority },
    reason: String(note || '').trim()
  });

  return {
    id: String(ticket._id),
    priority: ticket.priority
  };
}

async function replyToSupportTicket({ adminUser, ticketId, message }) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    const err = new Error('Reply message is required');
    err.statusCode = 400;
    throw err;
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  ticket.replies.push({
    author: adminUser.id,
    authorRole: 'admin',
    message: trimmed,
    createdAt: new Date()
  });
  ticket.lastRepliedAt = new Date();
  ticket.lastUpdatedAt = new Date();
  if (ticket.status === 'open') {
    ticket.status = 'in_progress';
  }
  await ticket.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: ticket.user || undefined,
    targetEntityId: ticket._id,
    targetEntityType: 'support_ticket',
    targetEntityName: ticket.title,
    actionType: 'SUPPORT_TICKET_REPLIED',
    previousValue: { status: 'open' },
    newValue: { status: ticket.status },
    reason: trimmed
  });

  return getSupportTicketDetails(ticketId);
}

async function addSupportTicketNote({ adminUser, ticketId, note }) {
  const trimmed = String(note || '').trim();
  if (!trimmed) {
    const err = new Error('Admin note is required');
    err.statusCode = 400;
    throw err;
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  ticket.adminNotes.push({
    note: trimmed,
    addedBy: adminUser.id,
    addedAt: new Date()
  });
  ticket.lastUpdatedAt = new Date();
  await ticket.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: ticket.user || undefined,
    targetEntityId: ticket._id,
    targetEntityType: 'support_ticket',
    targetEntityName: ticket.title,
    actionType: 'SUPPORT_TICKET_UPDATED',
    previousValue: { notes: (ticket.adminNotes?.length || 1) - 1 },
    newValue: { notes: ticket.adminNotes.length },
    reason: trimmed
  });

  return getSupportTicketDetails(ticketId);
}

async function deleteSupportTicket({ adminUser, ticketId }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    const err = new Error('Support ticket not found');
    err.statusCode = 404;
    throw err;
  }

  await SupportTicket.findByIdAndDelete(ticketId);

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: ticket.user || undefined,
    targetEntityId: ticket._id,
    targetEntityType: 'support_ticket',
    targetEntityName: ticket.title,
    actionType: 'SUPPORT_TICKET_DELETED',
    previousValue: { status: ticket.status },
    newValue: { status: 'deleted' },
    reason: 'Admin deleted ticket'
  });

  return { id: ticketId, deleted: true };
}

function buildFeedbackQuery({ search = '', status = '', itemType = '', createdFrom = '', createdTo = '' }) {
  const query = {};

  if (status && FEEDBACK_STATUSES.includes(status)) query.status = status;
  if (itemType && FEEDBACK_ITEM_TYPES.includes(itemType)) query.itemType = itemType;
  if (createdFrom || createdTo) {
    query.createdAt = {};
    if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
    if (createdTo) {
      const endDate = new Date(createdTo);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { itemTitle: regex },
      { message: regex }
    ];
  }

  return query;
}

async function listFeedbackEntries({
  search = '',
  status = '',
  itemType = '',
  createdFrom = '',
  createdTo = '',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const query = buildFeedbackQuery({ search, status, itemType, createdFrom, createdTo });

  const [items, total] = await Promise.all([
    FeedbackEntry.find(query)
      .populate('user', 'name email role forumRole')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    FeedbackEntry.countDocuments(query)
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      itemType: item.itemType || 'platform',
      itemId: item.itemId || '',
      itemTitle: item.itemTitle || '',
      message: item.message || '',
      rating: item.rating ?? null,
      status: item.status || 'new',
      createdAt: item.createdAt || null,
      user: item.user
        ? {
            id: String(item.user._id),
            name: item.user.name || '',
            email: item.user.email || '',
            role: item.user.forumRole === 'moderator' ? 'moderator' : item.user.role || 'student'
          }
        : null
    })),
    summary: {
      total,
      new: await FeedbackEntry.countDocuments({ status: 'new' }),
      reviewed: await FeedbackEntry.countDocuments({ status: 'reviewed' }),
      dismissed: await FeedbackEntry.countDocuments({ status: 'dismissed' }),
      resolved: await FeedbackEntry.countDocuments({ status: 'resolved' })
    },
    filters: {
      statuses: FEEDBACK_STATUSES,
      itemTypes: FEEDBACK_ITEM_TYPES
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function resolveFeedbackLink(entry) {
  if (!entry?.itemId) return '';
  if (entry.itemType === 'question') return '/admin/questions';
  if (entry.itemType === 'book') return '/admin/books';
  if (entry.itemType === 'contest') return '/admin/contests';
  if (entry.itemType === 'ielts_set') return '/admin/content/ielts-sets';
  return '';
}

async function getFeedbackDetails(feedbackId) {
  const feedback = await FeedbackEntry.findById(feedbackId)
    .populate('user', 'name email role forumRole')
    .populate('adminNotes.addedBy', 'name email')
    .lean();

  if (!feedback) {
    const err = new Error('Feedback entry not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: String(feedback._id),
    itemType: feedback.itemType || 'platform',
    itemId: feedback.itemId || '',
    itemTitle: feedback.itemTitle || '',
    message: feedback.message || '',
    rating: feedback.rating ?? null,
    status: feedback.status || 'new',
    createdAt: feedback.createdAt || null,
    linkPath: await resolveFeedbackLink(feedback),
    user: feedback.user
      ? {
          id: String(feedback.user._id),
          name: feedback.user.name || '',
          email: feedback.user.email || '',
          role: feedback.user.forumRole === 'moderator' ? 'moderator' : feedback.user.role || 'student'
        }
      : null,
    adminNotes: (feedback.adminNotes || []).map((item) => ({
      note: item.note || '',
      addedAt: item.addedAt || null,
      addedBy: item.addedBy
        ? {
            id: String(item.addedBy._id),
            name: item.addedBy.name || '',
            email: item.addedBy.email || ''
          }
        : null
    }))
  };
}

async function updateFeedbackStatus({ adminUser, feedbackId, status, note = '' }) {
  if (!FEEDBACK_STATUSES.includes(status)) {
    const err = new Error('Invalid feedback status');
    err.statusCode = 400;
    throw err;
  }

  const feedback = await FeedbackEntry.findById(feedbackId);
  if (!feedback) {
    const err = new Error('Feedback entry not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = feedback.status;
  feedback.status = status;
  if (note) {
    feedback.adminNotes.push({
      note: String(note).trim(),
      addedBy: adminUser.id,
      addedAt: new Date()
    });
  }
  await feedback.save();

  const actionType = status === 'reviewed'
    ? 'FEEDBACK_REVIEWED'
    : status === 'dismissed'
      ? 'FEEDBACK_DISMISSED'
      : status === 'resolved'
        ? 'FEEDBACK_RESOLVED'
        : 'FEEDBACK_REVIEWED';

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: feedback.user || undefined,
    targetEntityId: feedback._id,
    targetEntityType: 'feedback',
    targetEntityName: feedback.itemTitle || feedback.itemType,
    actionType,
    previousValue: { status: previousStatus },
    newValue: { status },
    reason: String(note || '').trim()
  });

  return getFeedbackDetails(feedbackId);
}

async function addFeedbackNote({ adminUser, feedbackId, note }) {
  const trimmed = String(note || '').trim();
  if (!trimmed) {
    const err = new Error('Admin note is required');
    err.statusCode = 400;
    throw err;
  }

  const feedback = await FeedbackEntry.findById(feedbackId);
  if (!feedback) {
    const err = new Error('Feedback entry not found');
    err.statusCode = 404;
    throw err;
  }

  feedback.adminNotes.push({
    note: trimmed,
    addedBy: adminUser.id,
    addedAt: new Date()
  });
  if (feedback.status === 'new') {
    feedback.status = 'reviewed';
  }
  await feedback.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: feedback.user || undefined,
    targetEntityId: feedback._id,
    targetEntityType: 'feedback',
    targetEntityName: feedback.itemTitle || feedback.itemType,
    actionType: 'FEEDBACK_REVIEWED',
    previousValue: { status: 'new' },
    newValue: { status: feedback.status },
    reason: trimmed
  });

  return getFeedbackDetails(feedbackId);
}

module.exports = {
  BROADCAST_AUDIENCES,
  BROADCAST_PRIORITIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_CATEGORIES,
  FEEDBACK_STATUSES,
  FEEDBACK_ITEM_TYPES,
  getNotificationAudienceStats,
  listBroadcasts,
  createBroadcast,
  listSupportTickets,
  getSupportTicketDetails,
  updateSupportTicketStatus,
  updateSupportTicketPriority,
  replyToSupportTicket,
  addSupportTicketNote,
  deleteSupportTicket,
  listFeedbackEntries,
  getFeedbackDetails,
  updateFeedbackStatus,
  addFeedbackNote
};
