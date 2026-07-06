const mongoose = require('mongoose');

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
      enum: [
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
        'QUESTION_APPROVED',
        'QUESTION_REJECTED',
        'QUESTION_EDITED',
        'QUESTION_REPORT_VALID',
        'QUESTION_REPORT_DISMISSED',
        'QUESTION_REPORT_RESOLVED',
        'BOOK_APPROVED',
        'BOOK_REJECTED',
        'IELTS_SET_APPROVED',
        'IELTS_SET_REJECTED',
        'NOTICE_CREATED',
        'NOTICE_UPDATED',
        'NOTICE_ARCHIVED',
        'NOTICE_DELETED',
        'WAITLIST_EXPORTED',
        'WAITLIST_MARKED_CONTACTED',
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
        'TOPIC_ARCHIVED'
      ],
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

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
