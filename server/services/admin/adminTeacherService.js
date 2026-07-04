const mongoose = require('mongoose');
const User = require('../../models/User');
const TeacherApplication = require('../../models/TeacherApplication');
const IeltsTeacher = require('../../models/IeltsTeacher');
const { createAdminAuditLog } = require('./adminAuditService');
const { notify } = require('../notificationService');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasVerificationDocuments(record) {
  if (!record) return false;
  return Boolean(
    record.studentIdCardPhoto ||
    record.nidPhoto ||
    record.ieltsTrf ||
    record.studentIdNumber ||
    record.universityName ||
    record.department
  );
}

function resolveApplicationState(application) {
  if (!application) return 'not_applied';
  if (application.status === 'approved' || application.status === 'rejected') {
    return application.status;
  }
  return application.reviewStage || 'pending';
}

function resolveVerificationState(record) {
  if (!record) return 'unverified';
  if (record.verificationStatus) return record.verificationStatus;
  return hasVerificationDocuments(record) ? 'pending' : 'unverified';
}

function resolveRequestedCategories(application) {
  if (!application) return [];

  const items = [];
  if (application.checkScript) items.push('Script checking');
  if (application.createQuestionBank) {
    items.push(
      application.createQuestionBankSubjects?.length
        ? `Question bank: ${application.createQuestionBankSubjects.join(', ')}`
        : 'Question bank'
    );
  }
  if (application.manageContest) items.push('Contest management');
  if (application.takeIeltsSpeaking) items.push('IELTS speaking');
  if (application.createIeltsQSet) items.push('IELTS question sets');
  return items;
}

function mapTeacherListItem(user, application, verification) {
  const requestedCategories = resolveRequestedCategories(application);
  const applicationStatus = resolveApplicationState(application);
  const verificationStatus = resolveVerificationState(verification);

  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    avatar: user.avatar || '',
    role: user.role || 'tutor',
    applicationStatus,
    verificationStatus,
    reviewStage: application?.reviewStage || 'pending',
    applicationDate: application?.createdAt || null,
    applicationUpdatedAt: application?.updatedAt || null,
    verificationUpdatedAt: verification?.updatedAt || null,
    requestedCategories,
    documentsCount: [
      verification?.studentIdCardPhoto,
      verification?.nidPhoto,
      verification?.ieltsTrf
    ].filter(Boolean).length,
    hasVerificationRecord: Boolean(verification),
    adminNote: application?.adminNote || verification?.verificationNote || '',
    reviewReason: application?.reviewReason || '',
    collegeName: user.collegeName || verification?.collegeName || '',
    universityName: user.universityName || verification?.universityName || ''
  };
}

function withinDateRange(value, from, to) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from) {
    const fromDate = new Date(from);
    if (date < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (date > toDate) return false;
  }
  return true;
}

async function listTeachers({
  search = '',
  status = '',
  verificationStatus = '',
  createdFrom = '',
  createdTo = '',
  view = 'all',
  page = 1,
  limit = 10
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  const [applicationIds, verificationIds, applications, verificationRecords] = await Promise.all([
    TeacherApplication.distinct('userId'),
    IeltsTeacher.distinct('userId'),
    TeacherApplication.find({}).lean(),
    IeltsTeacher.find({}).lean()
  ]);

  const users = await User.find({
    $or: [
      { role: 'teacher' },
      { _id: { $in: applicationIds } },
      { _id: { $in: verificationIds } }
    ]
  })
    .select('name email phoneNumber role avatar collegeName universityName department createdAt')
    .lean();

  const applicationMap = new Map(applications.map((item) => [String(item.userId), item]));
  const verificationMap = new Map(verificationRecords.map((item) => [String(item.userId), item]));
  const searchRegex = search ? new RegExp(escapeRegex(search), 'i') : null;

  let items = users
    .map((user) => mapTeacherListItem(user, applicationMap.get(String(user._id)), verificationMap.get(String(user._id))))
    .filter((item) => {
      if (view === 'applications' && item.applicationStatus === 'not_applied') return false;
      if (view === 'verification' && !item.hasVerificationRecord) return false;
      if (searchRegex) {
        const matched = [item.name, item.email, item.phoneNumber].some((value) => searchRegex.test(value || ''));
        if (!matched) return false;
      }
      if (status && item.applicationStatus !== status) return false;
      if (verificationStatus && item.verificationStatus !== verificationStatus) return false;
      if (createdFrom || createdTo) {
        const dateToCheck = item.applicationDate || item.applicationUpdatedAt || item.verificationUpdatedAt;
        if (!withinDateRange(dateToCheck, createdFrom, createdTo)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDate = new Date(a.applicationUpdatedAt || a.applicationDate || a.verificationUpdatedAt || 0).getTime();
      const bDate = new Date(b.applicationUpdatedAt || b.applicationDate || b.verificationUpdatedAt || 0).getTime();
      return bDate - aDate;
    });

  const total = items.length;
  const start = (safePage - 1) * safeLimit;
  items = items.slice(start, start + safeLimit);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getTeacherDetails(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('Teacher record not found');
    err.statusCode = 404;
    throw err;
  }

  const [user, application, verification] = await Promise.all([
    User.findById(userId)
      .select('-studentIdCardPhoto -nidPhoto -ieltsTrf -passwordHash -googleId')
      .lean(),
    TeacherApplication.findOne({ userId }).lean(),
    IeltsTeacher.findOne({ userId }).lean()
  ]);

  if (!user) {
    const err = new Error('Teacher record not found');
    err.statusCode = 404;
    throw err;
  }

  const documents = [
    {
      key: 'studentIdCardPhoto',
      label: 'Student ID card',
      url: verification?.studentIdCardPhoto || '',
      provided: Boolean(verification?.studentIdCardPhoto)
    },
    {
      key: 'nidPhoto',
      label: 'NID document',
      url: verification?.nidPhoto || '',
      provided: Boolean(verification?.nidPhoto)
    },
    {
      key: 'ieltsTrf',
      label: 'IELTS TRF',
      url: verification?.ieltsTrf || '',
      provided: Boolean(verification?.ieltsTrf)
    }
  ];

  return {
    id: String(user._id),
    profile: {
      name: user.name || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      avatar: user.avatar || '',
      role: user.role || 'tutor',
      collegeName: user.collegeName || verification?.collegeName || '',
      hscBatch: user.hscBatch || verification?.hscBatch || '',
      universityName: user.universityName || verification?.universityName || '',
      department: user.department || verification?.department || '',
      currentYearSemester: verification?.currentYearSemester || '',
      admissionAchievement: verification?.admissionAchievement || '',
      district: user.district || '',
      division: user.division || '',
      areaName: user.areaName || '',
      joinedDate: user.createdAt || null
    },
    application: application
      ? {
          status: resolveApplicationState(application),
          baseStatus: application.status,
          reviewStage: application.reviewStage || 'pending',
          aboutYou: application.aboutYou || '',
          adminNote: application.adminNote || '',
          reviewReason: application.reviewReason || '',
          requestedCategories: resolveRequestedCategories(application),
          details: {
            checkScriptDetails: application.checkScriptDetails || '',
            manageContestDetails: application.manageContestDetails || '',
            takeIeltsSpeakingDetails: application.takeIeltsSpeakingDetails || '',
            createIeltsQSetDetails: application.createIeltsQSetDetails || ''
          },
          createdAt: application.createdAt || null,
          updatedAt: application.updatedAt || null,
          reviewHistory: Array.isArray(application.reviewHistory) ? application.reviewHistory : []
        }
      : null,
    verification: {
      status: resolveVerificationState(verification),
      note: verification?.verificationNote || '',
      documents,
      fields: {
        studentIdNumber: verification?.studentIdNumber || '',
        ieltsScore: verification?.ieltsScore || '',
        universityName: verification?.universityName || '',
        department: verification?.department || '',
        currentYearSemester: verification?.currentYearSemester || '',
        admissionAchievement: verification?.admissionAchievement || '',
        dob: verification?.dob || null,
        gender: verification?.gender || ''
      },
      updatedAt: verification?.updatedAt || null,
      history: Array.isArray(verification?.verificationHistory) ? verification.verificationHistory : []
    }
  };
}

async function sendTeacherNotification(recipient, message, preview = '') {
  try {
    const { getIO } = require('../../socket');
    const io = getIO();
    await notify(io, {
      recipient,
      type: 'admin_update',
      message,
      preview
    });
  } catch (_) {
    try {
      await notify(null, {
        recipient,
        type: 'admin_update',
        message,
        preview
      });
    } catch (_) {
      return null;
    }
  }

  return true;
}

async function updateTeacherApplicationStatus({
  adminUser,
  targetUserId,
  decision,
  reason = '',
  note = ''
}) {
  const allowed = ['approved', 'rejected', 'under_review', 'more_info_requested'];
  if (!allowed.includes(decision)) {
    const err = new Error('Invalid teacher application action');
    err.statusCode = 400;
    throw err;
  }

  if ((decision === 'rejected' || decision === 'more_info_requested') && !String(reason).trim()) {
    const err = new Error('Reason is required for rejection or more-info requests');
    err.statusCode = 400;
    throw err;
  }

  const [user, application] = await Promise.all([
    User.findById(targetUserId),
    TeacherApplication.findOne({ userId: targetUserId })
  ]);

  if (!user || !application) {
    const err = new Error('Teacher application not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = resolveApplicationState(application);
  const previousRole = user.role;
  const now = new Date();

  if (decision === 'approved') {
    application.status = 'approved';
    application.reviewStage = 'approved';
    if (user.role !== 'teacher') {
      user.role = 'teacher';
    }
  } else if (decision === 'rejected') {
    application.status = 'rejected';
    application.reviewStage = 'rejected';
    if (previousStatus === 'approved' && user.role === 'teacher') {
      user.role = 'tutor';
    }
  } else {
    application.status = 'pending';
    application.reviewStage = decision;
  }

  application.reviewReason = String(reason || '').trim();
  application.adminNote = String(note || reason || '').trim();
  application.reviewedBy = adminUser.id;
  application.reviewedAt = now;
  application.reviewHistory.push({
    action: decision,
    previousStatus,
    nextStatus: resolveApplicationState(application),
    note: String(note || reason || '').trim(),
    actedBy: adminUser.id,
    actedAt: now
  });

  await Promise.all([application.save(), user.save()]);

  const actionType = {
    approved: 'TEACHER_APPROVED',
    rejected: 'TEACHER_REJECTED',
    more_info_requested: 'TEACHER_MORE_INFO_REQUESTED'
  }[decision];

  if (actionType) {
    await createAdminAuditLog({
      adminId: adminUser.id,
      targetUserId: user._id,
      actionType,
      previousValue: {
        applicationStatus: previousStatus,
        role: previousRole
      },
      newValue: {
        applicationStatus: resolveApplicationState(application),
        role: user.role
      },
      reason: String(reason || note || '').trim()
    });
  }

  const notificationMessage = {
    approved: 'Your teacher application has been approved.',
    rejected: 'Your teacher application was rejected. Please review the admin note.',
    under_review: 'Your teacher application is under review.',
    more_info_requested: 'More information is required for your teacher application.'
  }[decision];

  await sendTeacherNotification(
    user._id,
    notificationMessage,
    String(reason || note || '').trim().slice(0, 160)
  );

  return {
    id: String(user._id),
    applicationStatus: resolveApplicationState(application),
    role: user.role,
    reviewReason: application.reviewReason || '',
    adminNote: application.adminNote || ''
  };
}

async function updateTeacherVerificationStatus({
  adminUser,
  targetUserId,
  nextStatus,
  note = ''
}) {
  const allowed = ['unverified', 'pending', 'verified', 'rejected'];
  if (!allowed.includes(nextStatus)) {
    const err = new Error('Invalid verification status');
    err.statusCode = 400;
    throw err;
  }

  if (nextStatus === 'rejected' && !String(note).trim()) {
    const err = new Error('Reason is required when rejecting verification');
    err.statusCode = 400;
    throw err;
  }

  const [user, verification] = await Promise.all([
    User.findById(targetUserId),
    IeltsTeacher.findOne({ userId: targetUserId })
  ]);

  if (!user) {
    const err = new Error('Teacher record not found');
    err.statusCode = 404;
    throw err;
  }

  const record =
    verification ||
    new IeltsTeacher({
      userId: user._id,
      name: user.name,
      email: user.email
    });

  const previousStatus = resolveVerificationState(record);
  record.name = record.name || user.name;
  record.email = record.email || user.email;
  record.verificationStatus = nextStatus;
  record.verificationNote = String(note).trim();
  record.verifiedBy = adminUser.id;
  record.verifiedAt = new Date();
  record.verificationHistory.push({
    previousStatus,
    nextStatus,
    note: String(note).trim(),
    actedBy: adminUser.id,
    actedAt: new Date()
  });

  await record.save();

  if (nextStatus === 'verified' || nextStatus === 'rejected') {
    await createAdminAuditLog({
      adminId: adminUser.id,
      targetUserId: user._id,
      actionType: nextStatus === 'verified' ? 'TEACHER_VERIFIED' : 'TEACHER_VERIFICATION_REJECTED',
      previousValue: {
        verificationStatus: previousStatus
      },
      newValue: {
        verificationStatus: nextStatus
      },
      reason: String(note).trim()
    });
  }

  const notificationMessage =
    nextStatus === 'verified'
      ? 'Your teacher verification has been approved.'
      : nextStatus === 'rejected'
        ? 'Your teacher verification was rejected. Please review the admin note.'
        : 'Your teacher verification status has been updated.';

  await sendTeacherNotification(user._id, notificationMessage, String(note).trim().slice(0, 160));

  return {
    id: String(user._id),
    verificationStatus: nextStatus,
    verificationNote: record.verificationNote || ''
  };
}

module.exports = {
  listTeachers,
  getTeacherDetails,
  updateTeacherApplicationStatus,
  updateTeacherVerificationStatus,
  resolveApplicationState,
  resolveVerificationState
};
