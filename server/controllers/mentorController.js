const mongoose = require('mongoose');
const MentorConnection = require('../models/MentorConnection');
const MentorReview = require('../models/MentorReview');
const MockTestAttempt = require('../models/MockTestAttempt');
const User = require('../models/User');

const MENTOR_ROLES = ['tutor', 'teacher'];
const FIND_MENTOR_ROLES = ['tutor'];
const MAX_STUDENTS_PER_MENTOR = 30;

function isMentorRole(role) {
  return MENTOR_ROLES.includes(role);
}

function serializeAnonymousReview(review) {
  return {
    _id: review._id,
    rating: review.rating,
    comment: review.comment || '',
    createdAt: review.createdAt,
    reviewer: 'Anonymous student',
    isAnonymous: true
  };
}

function toSafeMentor(user, connectionStatus, reviewSummary = {}) {
  return {
    _id: user._id,
    name: user.name,
    avatar: user.avatar || '',
    role: user.role,
    universityName: user.universityName || '',
    department: user.department || '',
    currentYearSemester: user.currentYearSemester || '',
    admissionAchievement: user.admissionAchievement || '',
    interestedToGuide: Array.isArray(user.interestedToGuide) ? user.interestedToGuide : [],
    collegeName: user.collegeName || '',
    hscBatch: user.hscBatch || '',
    createdAt: user.createdAt,
    connectionStatus: connectionStatus || 'none',
    averageRating: reviewSummary.averageRating || 0,
    reviewCount: reviewSummary.reviewCount || 0,
    recentReviews: reviewSummary.recentReviews || [],
    currentUserReview: reviewSummary.currentUserReview || null
  };
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function getMentorReviewSummaries(mentorIds, studentId = null) {
  if (!mentorIds.length) {
    return new Map();
  }

  const [stats, reviews, currentUserReviews] = await Promise.all([
    MentorReview.aggregate([
      { $match: { mentor: { $in: mentorIds } } },
      {
        $group: {
          _id: '$mentor',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]),
    MentorReview.find({ mentor: { $in: mentorIds } })
      .sort({ createdAt: -1 })
      .select('mentor rating comment createdAt')
      .lean(),
    studentId
      ? MentorReview.find({ mentor: { $in: mentorIds }, student: studentId })
        .select('mentor rating comment createdAt updatedAt')
        .lean()
      : []
  ]);

  const summaryMap = new Map();
  mentorIds.forEach((id) => {
    summaryMap.set(String(id), {
      averageRating: 0,
      reviewCount: 0,
      recentReviews: [],
      currentUserReview: null
    });
  });

  stats.forEach((item) => {
    const summary = summaryMap.get(String(item._id));
    if (summary) {
      summary.averageRating = round2(item.averageRating);
      summary.reviewCount = item.reviewCount;
    }
  });

  reviews.forEach((review) => {
    const summary = summaryMap.get(String(review.mentor));
    if (summary && summary.recentReviews.length < 3) {
      summary.recentReviews.push(serializeAnonymousReview(review));
    }
  });

  currentUserReviews.forEach((review) => {
    const summary = summaryMap.get(String(review.mentor));
    if (summary) {
      summary.currentUserReview = serializeAnonymousReview(review);
    }
  });

  return summaryMap;
}

function sortMentorList(mentors, sort) {
  const sorted = [...mentors];
  if (sort === 'rating') {
    sorted.sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      return b.reviewCount - a.reviewCount;
    });
    return sorted;
  }

  if (sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }

  sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return sorted;
}

function buildStudentAttemptSummary(attempts) {
  if (!attempts.length) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      bestScore: 0,
      latestScore: 0,
      averageAccuracy: 0,
      latestAttemptAt: null,
      ranking: null,
      recentAttempts: [],
      subjectPerformance: []
    };
  }

  const subjectMap = new Map();
  let totalScore = 0;
  let totalAccuracy = 0;
  let bestScore = 0;

  attempts.forEach((attempt) => {
    totalScore += attempt.summary?.score || 0;
    bestScore = Math.max(bestScore, attempt.summary?.score || 0);

    const total = attempt.summary?.total || 0;
    const correct = attempt.summary?.correct || 0;
    totalAccuracy += total > 0 ? (correct / total) * 100 : 0;

    (attempt.subjectBreakdown || []).forEach((entry) => {
      const bucket = subjectMap.get(entry.subject) || {
        subject: entry.subject,
        total: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0
      };
      bucket.total += entry.total || 0;
      bucket.correct += entry.correct || 0;
      bucket.wrong += entry.wrong || 0;
      bucket.skipped += entry.skipped || 0;
      bucket.score += entry.score || 0;
      subjectMap.set(entry.subject, bucket);
    });
  });

  const latest = attempts[0];
  const subjectPerformance = Array.from(subjectMap.values())
    .map((entry) => ({
      ...entry,
      accuracy: entry.total ? round2((entry.correct / entry.total) * 100) : 0,
      score: round2(entry.score)
    }))
    .sort((a, b) => b.score - a.score);

  return {
    totalAttempts: attempts.length,
    averageScore: round2(totalScore / attempts.length),
    bestScore: round2(bestScore),
    latestScore: round2(latest.summary?.score || 0),
    averageAccuracy: round2(totalAccuracy / attempts.length),
    latestAttemptAt: latest.createdAt,
    ranking: latest.ranking || null,
    recentAttempts: attempts.slice(0, 5).map((attempt) => ({
      _id: attempt._id,
      score: round2(attempt.summary?.score || 0),
      correct: attempt.summary?.correct || 0,
      wrong: attempt.summary?.wrong || 0,
      skipped: attempt.summary?.skipped || 0,
      total: attempt.summary?.total || 0,
      timeTakenSeconds: attempt.summary?.timeTakenSeconds || 0,
      createdAt: attempt.createdAt,
      ranking: attempt.ranking || null
    })),
    subjectPerformance
  };
}

function buildMentorOverview(students) {
  const subjectMap = new Map();
  let attemptsCount = 0;
  let totalScore = 0;
  let latestRankingSum = 0;
  let rankedStudents = 0;

  students.forEach((student) => {
    totalScore += student.analytics.averageScore || 0;
    attemptsCount += student.analytics.totalAttempts || 0;

    if (student.analytics.ranking?.overallPosition) {
      latestRankingSum += student.analytics.ranking.overallPosition;
      rankedStudents += 1;
    }

    (student.analytics.subjectPerformance || []).forEach((entry) => {
      const bucket = subjectMap.get(entry.subject) || {
        subject: entry.subject,
        total: 0,
        correct: 0,
        score: 0
      };
      bucket.total += entry.total || 0;
      bucket.correct += entry.correct || 0;
      bucket.score += entry.score || 0;
      subjectMap.set(entry.subject, bucket);
    });
  });

  const subjectInsights = Array.from(subjectMap.values())
    .map((entry) => ({
      subject: entry.subject,
      total: entry.total,
      score: round2(entry.score),
      accuracy: entry.total ? round2((entry.correct / entry.total) * 100) : 0
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    totalStudents: students.length,
    activeStudents: students.filter((student) => student.analytics.totalAttempts > 0).length,
    totalAttempts: attemptsCount,
    averageStudentScore: students.length ? round2(totalScore / students.length) : 0,
    averageRanking: rankedStudents ? round2(latestRankingSum / rankedStudents) : null,
    subjectInsights
  };
}

const mentorController = {
  async listMentors(req, res, next) {
    try {
      const { sort = 'newest', university = '' } = req.query;
      const filter = {
        role: { $in: FIND_MENTOR_ROLES },
        isBanned: { $ne: true }
      };

      const universityFilter = String(university || '').trim();

      const mentors = await User.find(filter)
        .select('name avatar role universityName department currentYearSemester admissionAchievement interestedToGuide collegeName hscBatch createdAt')
        .sort({ createdAt: -1 })
        .lean();

      // Fetch IELTS teachers to merge details
      const IeltsTeacher = require('../models/IeltsTeacher');
      const ieltsTutors = await IeltsTeacher.find().lean();
      const ieltsMap = new Map(ieltsTutors.map(t => [String(t.userId), t]));

      const mergedMentors = mentors.map((mentor) => {
        const ieltsRecord = ieltsMap.get(String(mentor._id));
        if (ieltsRecord && (!mentor.universityName || (mentor.interestedToGuide.length === 1 && mentor.interestedToGuide[0] === 'IELTS'))) {
          return {
            ...mentor,
            studentIdNumber: ieltsRecord.studentIdNumber,
            collegeName: ieltsRecord.collegeName,
            hscBatch: ieltsRecord.hscBatch,
            universityName: ieltsRecord.universityName,
            department: ieltsRecord.department,
            currentYearSemester: ieltsRecord.currentYearSemester,
            admissionAchievement: ieltsRecord.admissionAchievement,
            interestedToGuide: ['IELTS'],
            ieltsScore: ieltsRecord.ieltsScore
          };
        }
        return mentor;
      });

      let finalMentors = mergedMentors;
      if (universityFilter) {
        const regex = new RegExp(universityFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        finalMentors = mergedMentors.filter(m => regex.test(m.universityName || ''));
      }

      const mentorIds = finalMentors.map((mentor) => mentor._id);
      const reviewSummaryMap = await getMentorReviewSummaries(
        mentorIds,
        req.user.role === 'student' ? req.user.id : null
      );

      let connectionMap = new Map();
      if (req.user.role === 'student') {
        const connections = await MentorConnection.find({ student: req.user.id })
          .select('mentor status')
          .lean();
        connectionMap = new Map(connections.map((item) => [String(item.mentor), item.status]));
      }

      return res.json({
        success: true,
        data: sortMentorList(
          finalMentors.map((mentor) => toSafeMentor(
            mentor,
            connectionMap.get(String(mentor._id)),
            reviewSummaryMap.get(String(mentor._id))
          )),
          sort
        )
      });
    } catch (err) {
      next(err);
    }
  },

  async getMentorProfile(req, res, next) {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can view mentor profiles.' });
      }

      const { mentorId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).json({ success: false, message: 'Invalid mentor selected.' });
      }

      const mentor = await User.findOne({
        _id: mentorId,
        role: { $in: FIND_MENTOR_ROLES },
        isBanned: { $ne: true }
      })
        .select('name avatar role universityName department currentYearSemester admissionAchievement interestedToGuide collegeName hscBatch createdAt')
        .lean();

      if (!mentor) {
        return res.status(404).json({ success: false, message: 'Mentor not found.' });
      }

      const IeltsTeacher = require('../models/IeltsTeacher');
      const ieltsRecord = await IeltsTeacher.findOne({ userId: mentor._id }).lean();
      if (ieltsRecord && (!mentor.universityName || (mentor.interestedToGuide.length === 1 && mentor.interestedToGuide[0] === 'IELTS'))) {
        mentor.studentIdNumber = ieltsRecord.studentIdNumber;
        mentor.collegeName = ieltsRecord.collegeName;
        mentor.hscBatch = ieltsRecord.hscBatch;
        mentor.universityName = ieltsRecord.universityName;
        mentor.department = ieltsRecord.department;
        mentor.currentYearSemester = ieltsRecord.currentYearSemester;
        mentor.admissionAchievement = ieltsRecord.admissionAchievement;
        mentor.interestedToGuide = ['IELTS'];
        mentor.ieltsScore = ieltsRecord.ieltsScore;
      }

      const [connection, reviewSummaryMap, reviews] = await Promise.all([
        MentorConnection.findOne({ student: req.user.id, mentor: mentorId }).select('status').lean(),
        getMentorReviewSummaries([mentor._id], req.user.id),
        MentorReview.find({ mentor: mentorId })
          .sort({ createdAt: -1 })
          .select('rating comment createdAt')
          .lean()
      ]);

      const summary = reviewSummaryMap.get(String(mentor._id)) || {};
      return res.json({
        success: true,
        data: {
          ...toSafeMentor(mentor, connection?.status || 'none', summary),
          reviews: reviews.map(serializeAnonymousReview)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async submitMentorReview(req, res, next) {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can review mentors.' });
      }

      const { mentorId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).json({ success: false, message: 'Invalid mentor selected.' });
      }

      const rating = Number(req.body?.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
      }

      const comment = String(req.body?.comment || '').trim().slice(0, 500);
      const mentor = await User.findById(mentorId).select('role isBanned');
      if (!mentor || mentor.isBanned || !isMentorRole(mentor.role)) {
        return res.status(404).json({ success: false, message: 'Mentor not found.' });
      }

      const isConnected = await MentorConnection.exists({
        student: req.user.id,
        mentor: mentorId,
        status: 'accepted'
      });

      if (!isConnected) {
        return res.status(403).json({ success: false, message: 'Only accepted students can review this mentor.' });
      }

      const review = await MentorReview.findOneAndUpdate(
        { mentor: mentorId, student: req.user.id },
        {
          $set: {
            rating: Math.round(rating),
            comment,
            isAnonymous: true
          }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      ).lean();

      return res.json({
        success: true,
        message: 'Anonymous review saved.',
        data: serializeAnonymousReview(review)
      });
    } catch (err) {
      next(err);
    }
  },

  async requestMentor(req, res, next) {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can send mentor requests.' });
      }

      const { mentorId } = req.body;
      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).json({ success: false, message: 'Invalid mentor selected.' });
      }

      if (String(mentorId) === String(req.user.id)) {
        return res.status(400).json({ success: false, message: 'You cannot request yourself.' });
      }

      const mentor = await User.findById(mentorId).select('name role isBanned');
      if (!mentor || mentor.isBanned || !isMentorRole(mentor.role)) {
        return res.status(404).json({ success: false, message: 'Mentor not found.' });
      }

      const acceptedCount = await MentorConnection.countDocuments({
        mentor: mentorId,
        status: 'accepted'
      });
      if (acceptedCount >= MAX_STUDENTS_PER_MENTOR) {
        return res.status(400).json({ success: false, message: 'This mentor already has the maximum number of students.' });
      }

      const existing = await MentorConnection.findOne({
        student: req.user.id,
        mentor: mentorId
      });

      if (existing?.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'You are already connected with this mentor.' });
      }

      if (existing?.status === 'pending') {
        return res.status(400).json({ success: false, message: 'Your request is already pending.' });
      }

      const connection = existing || new MentorConnection({
        student: req.user.id,
        mentor: mentorId
      });

      connection.status = 'pending';
      connection.requestedAt = new Date();
      connection.respondedAt = undefined;
      await connection.save();

      return res.json({
        success: true,
        message: `Request sent to ${mentor.name}.`,
        data: { status: connection.status, mentorId: String(mentorId) }
      });
    } catch (err) {
      next(err);
    }
  },

  async respondToRequest(req, res, next) {
    try {
      if (!isMentorRole(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Only mentors can respond to requests.' });
      }

      const { connectionId } = req.params;
      const { action } = req.body;
      if (!['accepted', 'declined'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action.' });
      }

      const connection = await MentorConnection.findOne({
        _id: connectionId,
        mentor: req.user.id
      });

      if (!connection) {
        return res.status(404).json({ success: false, message: 'Request not found.' });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'This request has already been handled.' });
      }

      if (action === 'accepted') {
        const acceptedCount = await MentorConnection.countDocuments({
          mentor: req.user.id,
          status: 'accepted'
        });
        if (acceptedCount >= MAX_STUDENTS_PER_MENTOR) {
          return res.status(400).json({ success: false, message: 'You already have 30 students connected.' });
        }
      }

      connection.status = action;
      connection.respondedAt = new Date();
      await connection.save();

      return res.json({
        success: true,
        message: action === 'accepted' ? 'Request accepted.' : 'Request declined.',
        data: { connectionId: String(connection._id), status: connection.status }
      });
    } catch (err) {
      next(err);
    }
  },

  async studentDashboard(req, res, next) {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can access this view.' });
      }

      const [connections, recentAttempts] = await Promise.all([
        MentorConnection.find({ student: req.user.id })
          .populate('mentor', 'name avatar role universityName department currentYearSemester admissionAchievement interestedToGuide collegeName hscBatch')
          .sort({ requestedAt: -1 })
          .lean(),
        MockTestAttempt.find({ student: req.user.id })
          .sort({ createdAt: -1 })
          .limit(6)
          .lean()
      ]);

      const mentors = connections.map((item) => ({
        _id: item._id,
        status: item.status,
        requestedAt: item.requestedAt,
        respondedAt: item.respondedAt,
        mentor: item.mentor ? toSafeMentor(item.mentor, item.status) : null
      })).filter((item) => item.mentor);

      return res.json({
        success: true,
        data: {
          mentorLimitPerMentor: MAX_STUDENTS_PER_MENTOR,
          mentors,
          recentAttempts: recentAttempts.map((attempt) => ({
            _id: attempt._id,
            score: round2(attempt.summary?.score || 0),
            correct: attempt.summary?.correct || 0,
            wrong: attempt.summary?.wrong || 0,
            skipped: attempt.summary?.skipped || 0,
            total: attempt.summary?.total || 0,
            timeTakenSeconds: attempt.summary?.timeTakenSeconds || 0,
            subjectBreakdown: attempt.subjectBreakdown || [],
            ranking: attempt.ranking || null,
            createdAt: attempt.createdAt
          }))
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async mentorDashboard(req, res, next) {
    try {
      if (!isMentorRole(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Only mentors can access this view.' });
      }

      const [pendingRequests, acceptedConnections] = await Promise.all([
        MentorConnection.find({ mentor: req.user.id, status: 'pending' })
          .populate('student', 'name avatar email collegeName hscBatch stream academicStatus aspirations')
          .sort({ requestedAt: -1 })
          .lean(),
        MentorConnection.find({ mentor: req.user.id, status: 'accepted' })
          .populate('student', 'name avatar email collegeName hscBatch stream academicStatus aspirations')
          .sort({ respondedAt: -1 })
          .lean()
      ]);

      const studentIds = acceptedConnections
        .map((item) => item.student?._id)
        .filter(Boolean);

      const attempts = studentIds.length
        ? await MockTestAttempt.find({ student: { $in: studentIds } })
          .sort({ createdAt: -1 })
          .lean()
        : [];

      const attemptsByStudent = attempts.reduce((acc, attempt) => {
        const key = String(attempt.student);
        if (!acc[key]) acc[key] = [];
        acc[key].push(attempt);
        return acc;
      }, {});

      const students = acceptedConnections
        .filter((item) => item.student)
        .map((connection) => {
          const studentId = String(connection.student._id);
          return {
            connectionId: connection._id,
            student: {
              _id: connection.student._id,
              name: connection.student.name,
              avatar: connection.student.avatar || '',
              email: connection.student.email || '',
              collegeName: connection.student.collegeName || '',
              hscBatch: connection.student.hscBatch || '',
              stream: connection.student.stream || '',
              academicStatus: connection.student.academicStatus || '',
              aspirations: Array.isArray(connection.student.aspirations) ? connection.student.aspirations : []
            },
            connectedAt: connection.respondedAt || connection.updatedAt,
            analytics: buildStudentAttemptSummary(attemptsByStudent[studentId] || [])
          };
        });

      return res.json({
        success: true,
        data: {
          capacity: MAX_STUDENTS_PER_MENTOR,
          pendingRequests: pendingRequests.map((item) => ({
            _id: item._id,
            requestedAt: item.requestedAt,
            student: item.student ? {
              _id: item.student._id,
              name: item.student.name,
              avatar: item.student.avatar || '',
              email: item.student.email || '',
              collegeName: item.student.collegeName || '',
              hscBatch: item.student.hscBatch || '',
              stream: item.student.stream || '',
              academicStatus: item.student.academicStatus || '',
              aspirations: Array.isArray(item.student.aspirations) ? item.student.aspirations : []
            } : null
          })).filter((item) => item.student),
          students,
          overview: buildMentorOverview(students)
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = mentorController;
