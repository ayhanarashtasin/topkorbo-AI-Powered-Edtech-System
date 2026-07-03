const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const IeltsListeningSet = require('../models/IeltsListeningSet');
const IeltsWritingSet = require('../models/IeltsWritingSet');

// Configure Multer storage for IELTS audio and pdfs
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads', 'ielts');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user && req.user.id ? String(req.user.id) : 'anonymous';
    const dir = path.join(UPLOAD_ROOT, userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nameWithoutExt = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${nameWithoutExt}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.mp3', '.wav', '.ogg', '.m4a'];
  if (allowedExts.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error('Only PDF and Audio files (.mp3, .wav, .ogg, .m4a) are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limits
});

// Helper response formatter
const errorResponse = (res, message, status = 400) => {
  return res.status(status).json({ success: false, message });
};

// POST Upload IELTS Listening set
router.post('/listening/upload', auth, upload.any(), async (req, res) => {
  try {
    // 1. Authorize
    if (req.user.role !== 'teacher') {
      return errorResponse(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName } = req.body;
    if (!setName || !setName.trim()) {
      return errorResponse(res, 'Please provide a name for the question set.');
    }

    // 2. Validate and group uploaded files
    const files = req.files || [];
    const sectionsMap = {
      1: { audioUrl: '', pdfUrl: '' },
      2: { audioUrl: '', pdfUrl: '' },
      3: { audioUrl: '', pdfUrl: '' },
      4: { audioUrl: '', pdfUrl: '' }
    };

    const userId = req.user.id;

    files.forEach(file => {
      // Fieldname format: "section[1-4]_audio" or "section[1-4]_pdf"
      const match = file.fieldname.match(/^section([1-4])_(audio|pdf)$/);
      if (match) {
        const secNum = parseInt(match[1]);
        const fileType = match[2]; // 'audio' or 'pdf'
        // HTTP URL format: /uploads/ielts/:userId/:filename
        const fileUrl = `/uploads/ielts/${userId}/${file.filename}`;
        
        if (fileType === 'audio') {
          sectionsMap[secNum].audioUrl = fileUrl;
        } else if (fileType === 'pdf') {
          sectionsMap[secNum].pdfUrl = fileUrl;
        }
      }
    });

    // 3. Ensure all 4 sections are complete (both files present for each)
    const missing = [];
    for (let sec = 1; sec <= 4; sec++) {
      if (!sectionsMap[sec].audioUrl) {
        missing.push(`Section ${sec} Audio`);
      }
      if (!sectionsMap[sec].pdfUrl) {
        missing.push(`Section ${sec} PDF`);
      }
    }

    if (missing.length > 0) {
      // Clean up uploaded files in case of failure
      files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting uploaded file on validation failure:', err);
        }
      });
      return errorResponse(res, `Upload incomplete. Missing files: ${missing.join(', ')}`);
    }

    // 4. Save to Database
    const sectionsArray = [];
    for (let sec = 1; sec <= 4; sec++) {
      sectionsArray.push({
        sectionNumber: sec,
        audioUrl: sectionsMap[sec].audioUrl,
        pdfUrl: sectionsMap[sec].pdfUrl
      });
    }

    const newSet = new IeltsListeningSet({
      creator: userId,
      setName: setName.trim(),
      sections: sectionsArray
    });

    await newSet.save();

    res.status(201).json({
      success: true,
      message: 'IELTS Listening question set uploaded and stored successfully!',
      data: newSet
    });

  } catch (err) {
    console.error('Error in IELTS Listening upload route:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch all uploaded sets (for verification or display)
router.get('/listening/sets', auth, async (req, res) => {
  try {
    const sets = await IeltsListeningSet.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch all approved IELTS teachers
router.get('/teachers', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const IeltsTeacher = require('../models/IeltsTeacher');

    const teachers = await User.find({
      role: 'teacher',
      interestedToGuide: 'IELTS',
      isBanned: { $ne: true }
    })
    .select('name avatar email interestedToGuide universityName department currentYearSemester admissionAchievement collegeName hscBatch')
    .lean();

    const teacherIds = teachers.map(t => t._id);
    const ieltsRecords = await IeltsTeacher.find({ userId: { $in: teacherIds } }).lean();
    const ieltsMap = new Map(ieltsRecords.map(r => [String(r.userId), r]));

    const result = teachers.map(t => {
      const record = ieltsMap.get(String(t._id));
      if (record) {
        return {
          ...t,
          ieltsScore: record.ieltsScore || 'N/A',
          universityName: record.universityName || t.universityName || 'N/A',
          department: record.department || t.department || 'N/A',
          currentYearSemester: record.currentYearSemester || t.currentYearSemester || 'N/A',
          admissionAchievement: record.admissionAchievement || t.admissionAchievement || 'N/A',
          collegeName: record.collegeName || t.collegeName || 'N/A',
          hscBatch: record.hscBatch || t.hscBatch || 'N/A'
        };
      }
      return {
        ...t,
        ieltsScore: 'N/A',
        universityName: t.universityName || 'N/A',
        department: t.department || 'N/A',
        currentYearSemester: t.currentYearSemester || 'N/A',
        admissionAchievement: t.admissionAchievement || 'N/A',
        collegeName: t.collegeName || 'N/A',
        hscBatch: t.hscBatch || 'N/A'
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// POST Request a speaking test appointment
router.post('/appointments', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Appointment = require('../models/Appointment');

    if (req.user.role !== 'student') {
      return errorResponse(res, 'Access denied. Only students can request speaking test appointments.', 403);
    }

    const { teacherId, date, timeSlot, message } = req.body;
    if (!teacherId || !date || !timeSlot) {
      return errorResponse(res, 'Teacher ID, date, and time slot are required fields.');
    }

    // Verify teacher exists and is an IELTS teacher
    const teacher = await User.findOne({
      _id: teacherId,
      role: 'teacher',
      interestedToGuide: 'IELTS',
      isBanned: { $ne: true }
    });

    if (!teacher) {
      return errorResponse(res, 'The selected teacher was not found or is not a qualified IELTS teacher.', 404);
    }

    const appointment = new Appointment({
      student: req.user.id,
      teacher: teacherId,
      date,
      timeSlot,
      message: message || ''
    });

    await appointment.save();

    res.status(201).json({
      success: true,
      message: 'Speaking test appointment requested successfully.',
      data: appointment
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch speaking test appointments
router.get('/appointments', auth, async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');
    const IeltsTeacher = require('../models/IeltsTeacher');

    let appointments;
    if (req.user.role === 'student') {
      appointments = await Appointment.find({ student: req.user.id })
        .populate('teacher', 'name email avatar')
        .sort({ createdAt: -1 })
        .lean();
      
      // Also populate teacher ieltsScore
      const teacherIds = appointments.map(app => app.teacher?._id).filter(Boolean);
      const ieltsRecords = await IeltsTeacher.find({ userId: { $in: teacherIds } }).select('userId ieltsScore universityName department').lean();
      const ieltsMap = new Map(ieltsRecords.map(r => [String(r.userId), r]));

      appointments = appointments.map(app => {
        if (app.teacher) {
          const record = ieltsMap.get(String(app.teacher._id));
          return {
            ...app,
            teacher: {
              ...app.teacher,
              ieltsScore: record?.ieltsScore || 'N/A',
              universityName: record?.universityName || '',
              department: record?.department || ''
            }
          };
        }
        return app;
      });

    } else if (req.user.role === 'teacher') {
      appointments = await Appointment.find({ teacher: req.user.id })
        .populate('student', 'name email avatar')
        .sort({ createdAt: -1 })
        .lean();
    } else {
      return errorResponse(res, 'Access denied.', 403);
    }

    res.json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// PATCH Update speaking test appointment status
router.patch('/appointments/:appointmentId/status', auth, async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');

    if (req.user.role !== 'teacher') {
      return errorResponse(res, 'Access denied. Only teachers can update appointment status.', 403);
    }

    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return errorResponse(res, 'Invalid status update value.');
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      teacher: req.user.id
    });

    if (!appointment) {
      return errorResponse(res, 'Appointment not found or you are not authorized to manage it.', 404);
    }

    appointment.status = status;
    await appointment.save();

    res.json({
      success: true,
      message: `Appointment ${status} successfully.`,
      data: appointment
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// POST Upload IELTS Writing set
router.post('/writing/upload', auth, upload.any(), async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return errorResponse(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName, task1Type, task2Type, task1Text, task2Text } = req.body;
    if (!setName || !setName.trim()) {
      return errorResponse(res, 'Please provide a name for the question set.');
    }

    if (!['pdf', 'text'].includes(task1Type) || !['pdf', 'text'].includes(task2Type)) {
      return errorResponse(res, 'Invalid task upload types.');
    }

    const files = req.files || [];
    let task1PdfUrl = '';
    let task2PdfUrl = '';
    const userId = req.user.id;

    files.forEach(file => {
      if (file.fieldname === 'task1Pdf') {
        task1PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
      } else if (file.fieldname === 'task2Pdf') {
        task2PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
      }
    });

    // Validate Task 1
    if (task1Type === 'pdf' && !task1PdfUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
      return errorResponse(res, 'Please upload a PDF file for Task 1.');
    }
    if (task1Type === 'text' && (!task1Text || !task1Text.trim())) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
      return errorResponse(res, 'Please enter a text prompt for Task 1.');
    }

    // Validate Task 2
    if (task2Type === 'pdf' && !task2PdfUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
      return errorResponse(res, 'Please upload a PDF file for Task 2.');
    }
    if (task2Type === 'text' && (!task2Text || !task2Text.trim())) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
      return errorResponse(res, 'Please enter a text prompt for Task 2.');
    }

    const newWritingSet = new IeltsWritingSet({
      creator: userId,
      setName: setName.trim(),
      task1: {
        type: task1Type,
        pdfUrl: task1Type === 'pdf' ? task1PdfUrl : undefined,
        textPrompt: task1Type === 'text' ? task1Text.trim() : undefined
      },
      task2: {
        type: task2Type,
        pdfUrl: task2Type === 'pdf' ? task2PdfUrl : undefined,
        textPrompt: task2Type === 'text' ? task2Text.trim() : undefined
      }
    });

    await newWritingSet.save();

    res.status(201).json({
      success: true,
      message: 'IELTS Writing question set uploaded successfully!',
      data: newWritingSet
    });

  } catch (err) {
    console.error('Error in IELTS Writing upload route:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch all IELTS Writing sets
router.get('/writing/sets', auth, async (req, res) => {
  try {
    const sets = await IeltsWritingSet.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

module.exports = router;
