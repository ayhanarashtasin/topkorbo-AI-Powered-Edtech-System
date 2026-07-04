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
      required: true,
      index: true
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
        'TEACHER_MORE_INFO_REQUESTED'
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
