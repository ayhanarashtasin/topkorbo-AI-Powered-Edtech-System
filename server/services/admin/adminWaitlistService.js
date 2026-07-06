const mongoose = require('mongoose');
const WaitlistEntry = require('../../models/WaitlistEntry');
const { createAdminAuditLog } = require('./adminAuditService');

function serializeEntry(entry) {
  const raw = entry.toObject ? entry.toObject() : entry;
  return {
    id: String(raw._id),
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    targetExam: raw.targetExam || 'Other',
    language: raw.language || 'en',
    contacted: Boolean(raw.contacted),
    contactedAt: raw.contactedAt || null,
    createdAt: raw.createdAt || null
  };
}

async function listWaitlistEntries({ search = '', contacted = '', targetExam = '', page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20));
  const query = {};

  if (contacted === 'true') query.contacted = true;
  if (contacted === 'false') query.contacted = false;
  if (targetExam) query.targetExam = targetExam;
  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const [items, total] = await Promise.all([
    WaitlistEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    WaitlistEntry.countDocuments(query)
  ]);

  return {
    items: items.map(serializeEntry),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function exportWaitlistEntries({ adminUser, search = '', contacted = '', targetExam = '' }) {
  const data = await listWaitlistEntries({ search, contacted, targetExam, page: 1, limit: 10000 });
  const header = ['Name', 'Email', 'Phone', 'Target Exam', 'Language', 'Contacted', 'Created At'];
  const rows = data.items.map((item) => ([
    item.name,
    item.email,
    item.phone,
    item.targetExam,
    item.language,
    item.contacted ? 'Yes' : 'No',
    item.createdAt ? new Date(item.createdAt).toISOString() : ''
  ]));
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'WAITLIST_EXPORTED',
    targetEntityId: '',
    targetEntityType: 'waitlist',
    targetEntityName: 'waitlist_export',
    previousValue: null,
    newValue: {
      exportedCount: data.items.length,
      filters: { search, contacted, targetExam }
    }
  });

  return csv;
}

async function markWaitlistContacted({ adminUser, entryId, contacted }) {
  if (!mongoose.Types.ObjectId.isValid(entryId)) {
    const err = new Error('Waitlist entry not found');
    err.statusCode = 404;
    throw err;
  }
  const entry = await WaitlistEntry.findById(entryId);
  if (!entry) {
    const err = new Error('Waitlist entry not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    contacted: Boolean(entry.contacted),
    contactedAt: entry.contactedAt || null
  };
  entry.contacted = Boolean(contacted);
  entry.contactedAt = entry.contacted ? new Date() : null;
  entry.contactedBy = entry.contacted ? adminUser.id : null;
  await entry.save();

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'WAITLIST_MARKED_CONTACTED',
    targetEntityId: String(entry._id),
    targetEntityType: 'waitlist_entry',
    targetEntityName: entry.email,
    previousValue,
    newValue: {
      contacted: entry.contacted,
      contactedAt: entry.contactedAt
    }
  });

  return serializeEntry(entry);
}

module.exports = {
  listWaitlistEntries,
  exportWaitlistEntries,
  markWaitlistContacted
};
