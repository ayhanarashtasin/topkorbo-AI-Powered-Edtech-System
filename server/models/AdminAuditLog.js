const mongoose = require('mongoose');

const ADMIN_AUDIT_ACTION_TYPES = [
  'ROLE_CHANGED',
  'USER_BANNED',
  'USER_UNBANNED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'TEACHER_APPROVED',
  'TEACHER_REJECTED',
  'TEACHER_VERIFIED',
  'TEACHER_VERIFICATION_REJECTED',
  'TEACHER_MORE_INFO_REQUESTED',
  'TEACHER_LIVE_SESSIONS_RESET',
  'QUESTION_APPROVED',
  'QUESTION_REJECTED',
  'QUESTION_EDITED',
  'QUESTION_REPORT_VALID',
  'QUESTION_REPORT_DISMISSED',
  'QUESTION_REPORT_RESOLVED',
  'REPORT_UNDER_REVIEW',
  'REPORT_DISMISSED',
  'REPORT_RESOLVED',
  'REPORT_NOTE_ADDED',
  'USER_WARNED',
  'CONTENT_HIDDEN',
  'APPEAL_APPROVED',
  'APPEAL_REJECTED',
  'APPEAL_NOTE_ADDED',
  'BOOK_APPROVED',
  'BOOK_REJECTED',
  'CONTEST_CREATED',
  'CONTEST_UPDATED',
  'CONTEST_CANCELLED',
  'CONTEST_ARCHIVED',
  'CONTEST_DELETED',
  'ATTEMPT_FLAGGED',
  'ATTEMPT_CLEARED',
  'ATTEMPT_REVIEW_NOTE_ADDED',
  'ATTEMPT_INVALIDATED',
  'CONTEST_MONITOR_REVIEWED',
  'IELTS_SET_APPROVED',
  'IELTS_SET_REJECTED',
  'NOTICE_CREATED',
  'NOTICE_UPDATED',
  'NOTICE_ARCHIVED',
  'NOTICE_DELETED',
  'WAITLIST_EXPORTED',
  'WAITLIST_MARKED_CONTACTED',
  'BROADCAST_SENT',
  'BROADCAST_FAILED',
  'SUPPORT_TICKET_UPDATED',
  'SUPPORT_TICKET_RESOLVED',
  'SUPPORT_TICKET_CLOSED',
  'SUPPORT_TICKET_REPLIED',
  'FEEDBACK_REVIEWED',
  'FEEDBACK_DISMISSED',
  'FEEDBACK_RESOLVED',
  'SUBJECT_CREATED',
  'SUBJECT_UPDATED',
  'SUBJECT_ARCHIVED',
  'PAPER_CREATED',
  'PAPER_UPDATED',
  'PAPER_ARCHIVED',
  'CHAPTER_CREATED',
  'CHAPTER_UPDATED',
  'CHAPTER_ARCHIVED',
  'TOPIC_CREATED',
  'TOPIC_UPDATED',
  'TOPIC_ARCHIVED',
  'PLAN_CREATED',
  'PLAN_UPDATED',
  'PLAN_ARCHIVED',
  'PLAN_DISABLED',
  'PREMIUM_GRANTED',
  'PREMIUM_REVOKED',
  'SETTINGS_UPDATED',
  'FEATURE_TOGGLE_UPDATED',
  'MAINTENANCE_MODE_UPDATED'
];

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    targetQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: false,
      index: true
    },
    targetEntityId: {
      type: String,
      default: '',
      index: true
    },
    targetEntityType: {
      type: String,
      default: '',
      index: true
    },
    targetEntityName: {
      type: String,
      default: ''
    },
    actionType: {
      type: String,
      enum: ADMIN_AUDIT_ACTION_TYPES,
      required: true,
      index: true
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500
    }
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1, actionType: 1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);

module.exports = AdminAuditLog;
module.exports.ADMIN_AUDIT_ACTION_TYPES = ADMIN_AUDIT_ACTION_TYPES;
