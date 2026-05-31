const mongoose = require('mongoose');

const waitlistEntrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^(\+88)?01[3-9]\d{8}$/, 'Please enter a valid Bangladeshi phone number']
  },
  targetExam: {
    type: String,
    enum: ['BUET', 'DU', 'Medical', 'RU', 'CU', 'CUET', 'SUST', 'Other'],
    default: 'Other'
  },
  language: {
    type: String,
    enum: ['en', 'bn'],
    default: 'en'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WaitlistEntry', waitlistEntrySchema);
