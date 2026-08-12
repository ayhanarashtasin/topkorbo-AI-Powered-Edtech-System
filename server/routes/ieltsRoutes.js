const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');
const IeltsListeningSet = require('../models/IeltsListeningSet');
const IeltsWritingSet = require('../models/IeltsWritingSet');
const IeltsReadingSet = require('../models/IeltsReadingSet');
const Groq = require('groq-sdk');
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY });
const VISION_MODEL = process.env.LLM_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = process.env.LLM_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

function normalizeApprovalStatus(doc) {
  return ['pending', 'approved', 'rejected'].includes(doc?.approvalStatus)
    ? doc.approvalStatus
    : 'approved';
}

function buildApprovedOrLegacyMatch() {
  return {
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } },
      { approvalStatus: null }
    ]
  };
}

function buildSetQueryForUser(user) {
  if (user?.role === 'admin') return {};
  if (user?.role === 'teacher') return {};
  return buildApprovedOrLegacyMatch();
}

async function generateCleanPrompt(type, filePath, textContent) {
  if (type === 'text') {
    return textContent ? textContent.trim() : '';
  }

  if (type === 'pdf') {
    try {
      const { extractPdfPages } = require('../services/pdfService');
      const buffer = fs.readFileSync(filePath);
      const pages = await extractPdfPages(buffer);
      const rawText = pages.map(p => p.text).join('\n').trim();

      if (!rawText) {
        return 'Empty PDF document. Could not extract text.';
      }

      const prompt = `Format the following extracted raw text of an IELTS writing question set into a clean, professional, and well-structured written question format. Remove any irrelevant OCR artifacts, page numbers, or headers. Provide only the clean, complete question text itself:\n\n${rawText}`;

      const completion = await groqClient.chat.completions.create({
        model: TEXT_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are an IELTS exam compiler. Format raw extracted text into clean, typed written IELTS exam prompts.' },
          { role: 'user', content: prompt }
        ]
      });

      return completion?.choices?.[0]?.message?.content?.trim() || rawText;
    } catch (err) {
      console.error('Error generating clean prompt from PDF:', err);
      return 'PDF Document Prompt';
    }
  }

  if (type === 'image') {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';

      const base64Image = imageBuffer.toString('base64');

      const completion = await groqClient.chat.completions.create({
        model: VISION_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe and rewrite this IELTS writing prompt image into a clean, typed written/described version of the question. Describe any charts, graphs, maps, diagrams, or pie charts in clean textual detail as if it were a typed description, so it can be easily understood in text format. Do not use generic placeholders; output a clean, self-contained typed prompt version of the question.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ]
      });

      return completion?.choices?.[0]?.message?.content?.trim() || 'Image Document Prompt';
    } catch (err) {
      console.error('Error generating clean prompt from image:', err);
      return 'Image Document Prompt';
    }
  }

  return '';
}


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
  const allowedExts = ['.pdf', '.mp3', '.wav', '.ogg', '.m4a', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  if (
    allowedExts.includes(ext) ||
    file.mimetype.startsWith('audio/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('image/')
  ) {
    return cb(null, true);
  }
  cb(new Error('Only PDF, Audio, and Image files (.pdf, .mp3, .wav, .ogg, .m4a, .png, .jpg, .jpeg, .webp, .gif) are allowed.'));
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
      sections: sectionsArray,
      approvalStatus: 'pending',
      rejectionReason: '',
      reviewedBy: null,
      reviewedAt: null
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
    const sets = await IeltsListeningSet.find(buildSetQueryForUser(req.user))
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      data: sets.map((set) => ({
        ...set.toObject(),
        approvalStatus: normalizeApprovalStatus(set)
      }))
    });
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
    const { status, meetingLink } = req.body;

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

    if (status === 'accepted') {
      if (!meetingLink || !meetingLink.trim()) {
        return errorResponse(res, 'Please provide a meeting link to accept the appointment.');
      }
      appointment.meetingLink = meetingLink.trim();
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

    if (!['pdf', 'text', 'image'].includes(task1Type) || !['pdf', 'text', 'image'].includes(task2Type)) {
      return errorResponse(res, 'Invalid task upload types.');
    }

    const files = req.files || [];
    let task1PdfUrl = '';
    let task2PdfUrl = '';
    let task1ImageUrl = '';
    let task2ImageUrl = '';
    let task1FilePath = '';
    let task2FilePath = '';
    const userId = req.user.id;

    files.forEach(file => {
      if (file.fieldname === 'task1Pdf') {
        task1PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
        task1FilePath = file.path;
      } else if (file.fieldname === 'task2Pdf') {
        task2PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
        task2FilePath = file.path;
      } else if (file.fieldname === 'task1Image') {
        task1ImageUrl = `/uploads/ielts/${userId}/${file.filename}`;
        task1FilePath = file.path;
      } else if (file.fieldname === 'task2Image') {
        task2ImageUrl = `/uploads/ielts/${userId}/${file.filename}`;
        task2FilePath = file.path;
      }
    });

    // Validate Task 1
    if (task1Type === 'pdf' && !task1PdfUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please upload a PDF file for Task 1.');
    }
    if (task1Type === 'image' && !task1ImageUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please upload an image file for Task 1.');
    }
    if (task1Type === 'text' && (!task1Text || !task1Text.trim())) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please enter a text prompt for Task 1.');
    }

    // Validate Task 2
    if (task2Type === 'pdf' && !task2PdfUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please upload a PDF file for Task 2.');
    }
    if (task2Type === 'image' && !task2ImageUrl) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please upload an image file for Task 2.');
    }
    if (task2Type === 'text' && (!task2Text || !task2Text.trim())) {
      files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { }
      });
      return errorResponse(res, 'Please enter a text prompt for Task 2.');
    }

    const cleanTask1Prompt = await generateCleanPrompt(task1Type, task1FilePath, task1Text);
    const cleanTask2Prompt = await generateCleanPrompt(task2Type, task2FilePath, task2Text);

    const newWritingSet = new IeltsWritingSet({
      creator: userId,
      setName: setName.trim(),
      task1: {
        type: task1Type,
        pdfUrl: task1Type === 'pdf' ? task1PdfUrl : undefined,
        imageUrl: task1Type === 'image' ? task1ImageUrl : undefined,
        textPrompt: task1Type === 'text' ? task1Text.trim() : undefined,
        cleanPrompt: cleanTask1Prompt
      },
      task2: {
        type: task2Type,
        pdfUrl: task2Type === 'pdf' ? task2PdfUrl : undefined,
        imageUrl: task2Type === 'image' ? task2ImageUrl : undefined,
        textPrompt: task2Type === 'text' ? task2Text.trim() : undefined,
        cleanPrompt: cleanTask2Prompt
      },
      approvalStatus: 'approved',
      rejectionReason: '',
      reviewedBy: null,
      reviewedAt: null
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
    const sets = await IeltsWritingSet.find(buildSetQueryForUser(req.user))
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      data: sets.map((set) => ({
        ...set.toObject(),
        approvalStatus: normalizeApprovalStatus(set)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// DELETE IELTS Writing set
router.delete('/writing/sets/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const set = await IeltsWritingSet.findById(req.params.id);
    if (!set) {
      return res.status(404).json({ success: false, message: 'Question set not found.' });
    }

    if (set.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. You can only delete your own question sets.' });
    }

    // Delete files
    const deleteFile = (urlPath) => {
      if (!urlPath) return;
      try {
        const filePath = path.join(__dirname, '..', urlPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    };
    deleteFile(set.task1?.pdfUrl);
    deleteFile(set.task1?.imageUrl);
    deleteFile(set.task2?.pdfUrl);
    deleteFile(set.task2?.imageUrl);

    await IeltsWritingSet.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'IELTS Writing question set deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting IELTS Writing set:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// POST Upload IELTS Reading set
router.post('/reading/upload', auth, upload.any(), async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return errorResponse(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName, passage1Type, passage2Type, passage3Type, passage1Text, passage2Text, passage3Text } = req.body;
    if (!setName || !setName.trim()) {
      return errorResponse(res, 'Please provide a name for the question set.');
    }

    if (!['pdf', 'text', 'image'].includes(passage1Type)) {
      return errorResponse(res, 'Invalid passage 1 upload type.');
    }

    const files = req.files || [];
    let passage1PdfUrl, passage2PdfUrl, passage3PdfUrl;
    let passage1ImageUrl, passage2ImageUrl, passage3ImageUrl;
    let passage1FilePath, passage2FilePath, passage3FilePath;
    const userId = req.user.id;

    files.forEach(file => {
      if (file.fieldname === 'passage1Pdf') {
        passage1PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage1FilePath = file.path;
      } else if (file.fieldname === 'passage2Pdf') {
        passage2PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage2FilePath = file.path;
      } else if (file.fieldname === 'passage3Pdf') {
        passage3PdfUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage3FilePath = file.path;
      } else if (file.fieldname === 'passage1Image') {
        passage1ImageUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage1FilePath = file.path;
      } else if (file.fieldname === 'passage2Image') {
        passage2ImageUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage2FilePath = file.path;
      } else if (file.fieldname === 'passage3Image') {
        passage3ImageUrl = `/uploads/ielts/${userId}/${file.filename}`;
        passage3FilePath = file.path;
      }
    });

    // Validate Passage 1
    if (passage1Type === 'pdf' && !passage1PdfUrl) {
      files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
      return errorResponse(res, 'Please upload a PDF file for Passage 1.');
    }
    if (passage1Type === 'image' && !passage1ImageUrl) {
      files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
      return errorResponse(res, 'Please upload an image file for Passage 1.');
    }
    if (passage1Type === 'text' && (!passage1Text || !passage1Text.trim())) {
      files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
      return errorResponse(res, 'Please enter a text prompt for Passage 1.');
    }

    // Validate Passage 2 (only if passage2Type is selected)
    if (passage2Type) {
      if (!['pdf', 'text', 'image'].includes(passage2Type)) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Invalid passage 2 upload type.');
      }
      if (passage2Type === 'pdf' && !passage2PdfUrl) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please upload a PDF file for Passage 2.');
      }
      if (passage2Type === 'image' && !passage2ImageUrl) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please upload an image file for Passage 2.');
      }
      if (passage2Type === 'text' && (!passage2Text || !passage2Text.trim())) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please enter a text prompt for Passage 2.');
      }
    }

    // Validate Passage 3 (only if passage3Type is selected)
    if (passage3Type) {
      if (!['pdf', 'text', 'image'].includes(passage3Type)) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Invalid passage 3 upload type.');
      }
      if (passage3Type === 'pdf' && !passage3PdfUrl) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please upload a PDF file for Passage 3.');
      }
      if (passage3Type === 'image' && !passage3ImageUrl) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please upload an image file for Passage 3.');
      }
      if (passage3Type === 'text' && (!passage3Text || !passage3Text.trim())) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) { } });
        return errorResponse(res, 'Please enter a text prompt for Passage 3.');
      }
    }

    const cleanPassage1Prompt = await generateCleanPrompt(passage1Type, passage1FilePath, passage1Text);
    const cleanPassage2Prompt = passage2Type ? await generateCleanPrompt(passage2Type, passage2FilePath, passage2Text) : undefined;
    const cleanPassage3Prompt = passage3Type ? await generateCleanPrompt(passage3Type, passage3FilePath, passage3Text) : undefined;

    const newReadingSet = new IeltsReadingSet({
      creator: userId,
      setName: setName.trim(),
      passage1: {
        type: passage1Type,
        pdfUrl: passage1Type === 'pdf' ? passage1PdfUrl : undefined,
        imageUrl: passage1Type === 'image' ? passage1ImageUrl : undefined,
        textPrompt: passage1Type === 'text' ? passage1Text.trim() : undefined,
        cleanPrompt: cleanPassage1Prompt
      },
      passage2: passage2Type ? {
        type: passage2Type,
        pdfUrl: passage2Type === 'pdf' ? passage2PdfUrl : undefined,
        imageUrl: passage2Type === 'image' ? passage2ImageUrl : undefined,
        textPrompt: passage2Type === 'text' ? passage2Text.trim() : undefined,
        cleanPrompt: cleanPassage2Prompt
      } : undefined,
      passage3: passage3Type ? {
        type: passage3Type,
        pdfUrl: passage3Type === 'pdf' ? passage3PdfUrl : undefined,
        imageUrl: passage3Type === 'image' ? passage3ImageUrl : undefined,
        textPrompt: passage3Type === 'text' ? passage3Text.trim() : undefined,
        cleanPrompt: cleanPassage3Prompt
      } : undefined
    });

    await newReadingSet.save();

    res.status(201).json({
      success: true,
      message: 'IELTS Reading question set uploaded successfully!',
      data: newReadingSet
    });

  } catch (err) {
    console.error('Error in IELTS Reading upload route:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// GET Fetch all IELTS Reading sets
router.get('/reading/sets', auth, async (req, res) => {
  try {
    const sets = await IeltsReadingSet.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: sets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// POST Evaluate IELTS Writing set responses using AI tutor
router.post('/writing/evaluate', auth, async (req, res) => {
  try {
    const { setId, task1Answer, task2Answer } = req.body;
    if (!setId) {
      return errorResponse(res, 'Writing set ID is required.');
    }

    const set = await IeltsWritingSet.findById(setId);
    if (!set) {
      return errorResponse(res, 'IELTS Writing set not found.', 404);
    }

    const evaluateTask = async (task, taskLabel, studentAnswer) => {
      if (!task || !studentAnswer || !studentAnswer.trim()) {
        return null;
      }

      const taskPromptText = task.cleanPrompt || task.textPrompt || `${taskLabel} prompt.`;

      const promptText = `You are an expert IELTS Writing examiner. Evaluate the student's response for the following task:

Task Type: ${taskLabel}
Task Prompt / Question:
${taskPromptText}

Student's Answer:
${studentAnswer}

Please grade the response according to the official IELTS assessment criteria:
1. Task Achievement / Response (0-9)
2. Coherence and Cohesion (0-9)
3. Lexical Resource (0-9)
4. Grammatical Range and Accuracy (0-9)

Provide an overall band score for this task (0-9, can be in 0.5 increments, e.g. 6.5, 7.0).
Provide detailed feedback and specific suggestions for improvement.

Return ONLY a valid JSON object in this exact format:
{
  "bandScore": 6.5,
  "criteria": {
    "taskAchievement": { "score": 6.5, "comments": "Explanation for task achievement." },
    "coherenceCohesion": { "score": 6.0, "comments": "Explanation for coherence and cohesion." },
    "lexicalResource": { "score": 7.0, "comments": "Explanation for lexical resource." },
    "grammaticalRangeAccuracy": { "score": 6.5, "comments": "Explanation for grammatical range and accuracy." }
  },
  "feedback": "Overall narrative feedback on the writing response.",
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ]
}
Do not return any other text, markdown formatting (outside the JSON structure), or explanations.`;

      try {
        const completion = await groqClient.chat.completions.create({
          model: TEXT_MODEL,
          messages: [
            { role: 'system', content: 'You are an IELTS exam evaluator. Evaluate written responses and output JSON.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.3
        });

        const contentText = completion.choices[0].message.content;
        return JSON.parse(contentText);
      } catch (err) {
        console.error(`Error evaluating ${taskLabel}:`, err);
        return {
          bandScore: 0,
          criteria: {
            taskAchievement: { score: 0, comments: err.message },
            coherenceCohesion: { score: 0, comments: err.message },
            lexicalResource: { score: 0, comments: err.message },
            grammaticalRangeAccuracy: { score: 0, comments: err.message }
          },
          feedback: `Failed to evaluate: ${err.message}`,
          suggestions: []
        };
      }
    };

    const [eval1, eval2] = await Promise.all([
      evaluateTask(set.task1, 'Task 1', task1Answer),
      evaluateTask(set.task2, 'Task 2', task2Answer)
    ]);

    let overallBandScore = 0;
    if (eval1 && eval2) {
      // IELTS weighting: Task 2 is worth twice as much as Task 1
      const weightedAverage = (eval1.bandScore + 2 * eval2.bandScore) / 3;
      overallBandScore = roundToIeltsBand(weightedAverage);
    } else if (eval1) {
      overallBandScore = eval1.bandScore;
    } else if (eval2) {
      overallBandScore = eval2.bandScore;
    }

    res.json({
      success: true,
      overallBandScore,
      task1Evaluation: eval1,
      task2Evaluation: eval2
    });

  } catch (err) {
    console.error('Error in IELTS Writing evaluation route:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

function roundToIeltsBand(score) {
  const fraction = score - Math.floor(score);
  if (fraction < 0.25) {
    return Math.floor(score);
  } else if (fraction < 0.75) {
    return Math.floor(score) + 0.5;
  } else {
    return Math.ceil(score);
  }
}

module.exports = router;
