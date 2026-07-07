const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'platform'
    },
    academicYear: {
      type: String,
      default: ''
    },
    registrationEnabled: {
      type: Boolean,
      default: true
    },
    maintenanceMode: {
      enabled: {
        type: Boolean,
        default: false
      },
      message: {
        type: String,
        default: '',
        maxlength: 240
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
