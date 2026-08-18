/**
 * IELTS Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles HTTP requests for IELTS Listening, Reading, Writing, Speaking tests,
 * and teacher appointments. Delegates business logic and AI evaluation to
 * ieltsService.js.
 */

const fs = require('fs');
const IeltsListeningSet = require('../models/IeltsListeningSet');
const IeltsWritingSet = require('../models/IeltsWritingSet');
const IeltsReadingSet = require('../models/IeltsReadingSet');
const IeltsTeacher = require('../models/IeltsTeacher');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const {
  normalizeApprovalStatus,
  buildSetQueryForUser,
  generateCleanPrompt,
  evaluateWritingSet,
  deleteLocalFile
} = require('../services/ieltsService');

/**
 * POST /api/ielts/listening/upload
 * Upload IELTS Listening question set (Teacher only)
 */
exports.uploadListeningSet = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return ApiResponse.error(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName } = req.body;
    if (!setName || !setName.trim()) {
      return ApiResponse.error(res, 'Please provide a name for the question set.', 400);
    }

    const files = req.files || [];
    const sectionsMap = {
      1: { audioUrl: '', pdfUrl: '' },
      2: { audioUrl: '', pdfUrl: '' },
      3: { audioUrl: '', pdfUrl: '' },
      4: { audioUrl: '', pdfUrl: '' }
    };

    const userId = req.user.id;

    files.forEach((file) => {
      const match = file.fieldname.match(/^section([1-4])_(audio|pdf)$/);
      if (match) {
        const secNum = parseInt(match[1], 10);
        const fileType = match[2];
        const fileUrl = `/uploads/ielts/${userId}/${file.filename}`;

        if (fileType === 'audio') {
          sectionsMap[secNum].audioUrl = fileUrl;
        } else if (fileType === 'pdf') {
          sectionsMap[secNum].pdfUrl = fileUrl;
        }
      }
    });

    const missing = [];
    for (let sec = 1; sec <= 4; sec++) {
      if (!sectionsMap[sec].audioUrl) missing.push(`Section ${sec} Audio`);
      if (!sectionsMap[sec].pdfUrl) missing.push(`Section ${sec} PDF`);
    }

    if (missing.length > 0) {
      files.forEach((file) => {
        try { fs.unlinkSync(file.path); } catch (_) {}
      });
      return ApiResponse.error(res, `Upload incomplete. Missing files: ${missing.join(', ')}`, 400);
    }

    const sectionsArray = [];
    for (let sec = 1; sec <= 4; sec++) {
      sectionsArray.push({
        sectionNumber: sec,
        audioUrl: sectionsMap[sec].audioUrl,
        pdfUrl: sectionsMap[sec].pdfUrl
      });
    }

    const newSet = await IeltsListeningSet.create({
      creator: userId,
      setName: setName.trim(),
      sections: sectionsArray,
      approvalStatus: 'pending',
      rejectionReason: '',
      reviewedBy: null,
      reviewedAt: null
    });

    return ApiResponse.success(res, newSet, 'IELTS Listening question set uploaded and stored successfully!', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ielts/listening/sets
 * Fetch all available listening sets
 */
exports.getListeningSets = async (req, res, next) => {
  try {
    const sets = await IeltsListeningSet.find(buildSetQueryForUser(req.user))
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    const formatted = sets.map((set) => ({
      ...set.toObject(),
      approvalStatus: normalizeApprovalStatus(set)
    }));

    return ApiResponse.success(res, formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ielts/teachers
 * Fetch all approved IELTS teachers
 */
exports.getApprovedTeachers = async (req, res, next) => {
  try {
    const teachers = await User.find({
      role: 'teacher',
      interestedToGuide: 'IELTS',
      isBanned: { $ne: true }
    })
      .select('name avatar email interestedToGuide universityName department currentYearSemester admissionAchievement collegeName hscBatch')
      .lean();

    const teacherIds = teachers.map((t) => t._id);
    const ieltsRecords = await IeltsTeacher.find({ userId: { $in: teacherIds } }).lean();
    const ieltsMap = new Map(ieltsRecords.map((r) => [String(r.userId), r]));

    const result = teachers.map((t) => {
      const record = ieltsMap.get(String(t._id));
      return {
        ...t,
        ieltsScore: record?.ieltsScore || 'N/A',
        universityName: record?.universityName || t.universityName || 'N/A',
        department: record?.department || t.department || 'N/A',
        currentYearSemester: record?.currentYearSemester || t.currentYearSemester || 'N/A',
        admissionAchievement: record?.admissionAchievement || t.admissionAchievement || 'N/A',
        collegeName: record?.collegeName || t.collegeName || 'N/A',
        hscBatch: record?.hscBatch || t.hscBatch || 'N/A'
      };
    });

    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ielts/appointments
 * Request a speaking test appointment (Student only)
 */
exports.createAppointment = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return ApiResponse.error(res, 'Access denied. Only students can request speaking test appointments.', 403);
    }

    const { teacherId, date, timeSlot, message } = req.body;
    if (!teacherId || !date || !timeSlot) {
      return ApiResponse.error(res, 'Teacher ID, date, and time slot are required fields.', 400);
    }

    const teacher = await User.findOne({
      _id: teacherId,
      role: 'teacher',
      interestedToGuide: 'IELTS',
      isBanned: { $ne: true }
    });

    if (!teacher) {
      return ApiResponse.error(res, 'The selected teacher was not found or is not a qualified IELTS teacher.', 404);
    }

    const appointment = await Appointment.create({
      student: req.user.id,
      teacher: teacherId,
      date,
      timeSlot,
      message: message || ''
    });

    return ApiResponse.success(res, appointment, 'Speaking test appointment requested successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ielts/appointments
 * Fetch speaking test appointments for current user (student or teacher)
 */
exports.getAppointments = async (req, res, next) => {
  try {
    let appointments;
    if (req.user.role === 'student') {
      appointments = await Appointment.find({ student: req.user.id })
        .populate('teacher', 'name email avatar')
        .sort({ createdAt: -1 })
        .lean();

      const teacherIds = appointments.map((app) => app.teacher?._id).filter(Boolean);
      const ieltsRecords = await IeltsTeacher.find({ userId: { $in: teacherIds } })
        .select('userId ieltsScore universityName department')
        .lean();
      const ieltsMap = new Map(ieltsRecords.map((r) => [String(r.userId), r]));

      appointments = appointments.map((app) => {
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
      return ApiResponse.error(res, 'Access denied.', 403);
    }

    return ApiResponse.success(res, appointments);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/ielts/appointments/:appointmentId/status
 * Update speaking test appointment status (Teacher only)
 */
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return ApiResponse.error(res, 'Access denied. Only teachers can update appointment status.', 403);
    }

    const { appointmentId } = req.params;
    const { status, meetingLink } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return ApiResponse.error(res, 'Invalid status update value.', 400);
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      teacher: req.user.id
    });

    if (!appointment) {
      return ApiResponse.error(res, 'Appointment not found or you are not authorized to manage it.', 404);
    }

    if (status === 'accepted') {
      if (!meetingLink || !meetingLink.trim()) {
        return ApiResponse.error(res, 'Please provide a meeting link to accept the appointment.', 400);
      }
      appointment.meetingLink = meetingLink.trim();
    }

    appointment.status = status;
    await appointment.save();

    return ApiResponse.success(res, appointment, `Appointment ${status} successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ielts/writing/upload
 * Upload IELTS Writing question set (Teacher only)
 */
exports.uploadWritingSet = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return ApiResponse.error(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName, task1Type, task2Type, task1Text, task2Text } = req.body;
    if (!setName || !setName.trim()) {
      return ApiResponse.error(res, 'Please provide a name for the question set.', 400);
    }

    if (!['pdf', 'text', 'image'].includes(task1Type) || !['pdf', 'text', 'image'].includes(task2Type)) {
      return ApiResponse.error(res, 'Invalid task upload types.', 400);
    }

    const files = req.files || [];
    let task1PdfUrl = '';
    let task2PdfUrl = '';
    let task1ImageUrl = '';
    let task2ImageUrl = '';
    let task1FilePath = '';
    let task2FilePath = '';
    const userId = req.user.id;

    files.forEach((file) => {
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

    const cleanupUploadedFiles = () => {
      files.forEach((file) => {
        try { fs.unlinkSync(file.path); } catch (_) {}
      });
    };

    if (task1Type === 'pdf' && !task1PdfUrl) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please upload a PDF file for Task 1.', 400);
    }
    if (task1Type === 'image' && !task1ImageUrl) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please upload an image file for Task 1.', 400);
    }
    if (task1Type === 'text' && (!task1Text || !task1Text.trim())) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please enter a text prompt for Task 1.', 400);
    }

    if (task2Type === 'pdf' && !task2PdfUrl) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please upload a PDF file for Task 2.', 400);
    }
    if (task2Type === 'image' && !task2ImageUrl) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please upload an image file for Task 2.', 400);
    }
    if (task2Type === 'text' && (!task2Text || !task2Text.trim())) {
      cleanupUploadedFiles();
      return ApiResponse.error(res, 'Please enter a text prompt for Task 2.', 400);
    }

    const cleanTask1Prompt = await generateCleanPrompt(task1Type, task1FilePath, task1Text);
    const cleanTask2Prompt = await generateCleanPrompt(task2Type, task2FilePath, task2Text);

    const newWritingSet = await IeltsWritingSet.create({
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

    return ApiResponse.success(res, newWritingSet, 'IELTS Writing question set uploaded successfully!', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ielts/writing/sets
 * Fetch all IELTS writing sets
 */
exports.getWritingSets = async (req, res, next) => {
  try {
    const sets = await IeltsWritingSet.find(buildSetQueryForUser(req.user))
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    const formatted = sets.map((set) => ({
      ...set.toObject(),
      approvalStatus: normalizeApprovalStatus(set)
    }));

    return ApiResponse.success(res, formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/ielts/writing/sets/:id
 * Delete IELTS Writing set (Owner teacher or admin)
 */
exports.deleteWritingSet = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Access denied.', 403);
    }

    const set = await IeltsWritingSet.findById(req.params.id);
    if (!set) {
      return ApiResponse.error(res, 'Question set not found.', 404);
    }

    if (set.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Access denied. You can only delete your own question sets.', 403);
    }

    deleteLocalFile(set.task1?.pdfUrl);
    deleteLocalFile(set.task1?.imageUrl);
    deleteLocalFile(set.task2?.pdfUrl);
    deleteLocalFile(set.task2?.imageUrl);

    await IeltsWritingSet.findByIdAndDelete(req.params.id);

    return ApiResponse.success(res, null, 'IELTS Writing question set deleted successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ielts/reading/upload
 * Upload IELTS Reading set (Teacher only)
 */
exports.uploadReadingSet = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return ApiResponse.error(res, 'Access denied. Only teachers can upload IELTS question sets.', 403);
    }

    const { setName, passage1Type, passage2Type, passage3Type, passage1Text, passage2Text, passage3Text } = req.body;
    if (!setName || !setName.trim()) {
      return ApiResponse.error(res, 'Please provide a name for the question set.', 400);
    }

    if (!['pdf', 'text', 'image'].includes(passage1Type)) {
      return ApiResponse.error(res, 'Invalid passage 1 upload type.', 400);
    }

    const files = req.files || [];
    let passage1PdfUrl, passage2PdfUrl, passage3PdfUrl;
    let passage1ImageUrl, passage2ImageUrl, passage3ImageUrl;
    let passage1FilePath, passage2FilePath, passage3FilePath;
    const userId = req.user.id;

    files.forEach((file) => {
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

    const cleanupFiles = () => {
      files.forEach((file) => {
        try { fs.unlinkSync(file.path); } catch (_) {}
      });
    };

    if (passage1Type === 'pdf' && !passage1PdfUrl) {
      cleanupFiles();
      return ApiResponse.error(res, 'Please upload a PDF file for Passage 1.', 400);
    }
    if (passage1Type === 'image' && !passage1ImageUrl) {
      cleanupFiles();
      return ApiResponse.error(res, 'Please upload an image file for Passage 1.', 400);
    }
    if (passage1Type === 'text' && (!passage1Text || !passage1Text.trim())) {
      cleanupFiles();
      return ApiResponse.error(res, 'Please enter a text prompt for Passage 1.', 400);
    }

    if (passage2Type) {
      if (!['pdf', 'text', 'image'].includes(passage2Type)) {
        cleanupFiles();
        return ApiResponse.error(res, 'Invalid passage 2 upload type.', 400);
      }
      if (passage2Type === 'pdf' && !passage2PdfUrl) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please upload a PDF file for Passage 2.', 400);
      }
      if (passage2Type === 'image' && !passage2ImageUrl) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please upload an image file for Passage 2.', 400);
      }
      if (passage2Type === 'text' && (!passage2Text || !passage2Text.trim())) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please enter a text prompt for Passage 2.', 400);
      }
    }

    if (passage3Type) {
      if (!['pdf', 'text', 'image'].includes(passage3Type)) {
        cleanupFiles();
        return ApiResponse.error(res, 'Invalid passage 3 upload type.', 400);
      }
      if (passage3Type === 'pdf' && !passage3PdfUrl) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please upload a PDF file for Passage 3.', 400);
      }
      if (passage3Type === 'image' && !passage3ImageUrl) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please upload an image file for Passage 3.', 400);
      }
      if (passage3Type === 'text' && (!passage3Text || !passage3Text.trim())) {
        cleanupFiles();
        return ApiResponse.error(res, 'Please enter a text prompt for Passage 3.', 400);
      }
    }

    const cleanPassage1Prompt = await generateCleanPrompt(passage1Type, passage1FilePath, passage1Text);
    const cleanPassage2Prompt = passage2Type ? await generateCleanPrompt(passage2Type, passage2FilePath, passage2Text) : undefined;
    const cleanPassage3Prompt = passage3Type ? await generateCleanPrompt(passage3Type, passage3FilePath, passage3Text) : undefined;

    const newReadingSet = await IeltsReadingSet.create({
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

    return ApiResponse.success(res, newReadingSet, 'IELTS Reading question set uploaded successfully!', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ielts/reading/sets
 * Fetch all IELTS Reading sets
 */
exports.getReadingSets = async (req, res, next) => {
  try {
    const sets = await IeltsReadingSet.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    return ApiResponse.success(res, sets);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/ielts/writing/evaluate
 * Evaluate student's IELTS Writing answers using Groq AI examiner
 */
exports.evaluateWriting = async (req, res, next) => {
  try {
    const { setId, task1Answer, task2Answer } = req.body;
    if (!setId) {
      return ApiResponse.error(res, 'Writing set ID is required.', 400);
    }

    const set = await IeltsWritingSet.findById(setId);
    if (!set) {
      return ApiResponse.error(res, 'IELTS Writing set not found.', 404);
    }

    const evaluationResult = await evaluateWritingSet(set, task1Answer, task2Answer);

    return res.json({
      success: true,
      overallBandScore: evaluationResult.overallBandScore,
      task1Evaluation: evaluationResult.task1Evaluation,
      task2Evaluation: evaluationResult.task2Evaluation
    });
  } catch (err) {
    next(err);
  }
};
