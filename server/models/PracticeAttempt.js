/**
 * PracticeAttempt
 * ----------------------------------------------------------------------------
 * Records every practice session a student takes on TopKorbo. This covers
 * three surfaces:
 *   - Mock Tests (configurable timer, full exam environment)
 *   - Question Bank inline practice (option B: each answered question is
 *     logged as a lightweight attempt, no separate "session")
 *   - Free Practice (manual / un-timed sessions)
 *
 * Stored fields cover the full context: subject hierarchy (subject, paper,
 * chapter, topic), per-question answers, AI evaluation scores, marks,
 * timing, device metadata. Snapshots are immutable so that even if the
 * source question is later edited or deleted, the attempt history remains
 * intact for the student.
 *
 * Retained forever (no TTL). Users can delete their own attempts via
 * `DELETE /api/practice/:id`; admins can delete via moderation routes.
 */

const mongoose = require('mongoose');

const perQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    // Full snapshot of the question at the time of attempt
    snapshot: {
      type: { type: String, enum: ['mcq', 'written', 'cq'], default: 'mcq' },
      questionText: { type: String, default: '' },
      imageUrl: { type: String, default: '' },
      options: [
        {
          text: { type: String, default: '' },
          isCorrect: { type: Boolean, default: false }
        }
      ],
      correctIndex: { type: Number, default: -1 },
      cq: {
        description: { type: String, default: '' },
        parts: [
          {
            label: { type: String, default: '' },
            text: { type: String, default: '' }
          }
        ]
      },
      marks: { type: Number, default: 1 },
      solution: { type: String, default: '' }
    },
    // Classification — denormalized for fast filtering/aggregation
    subject: { type: String, default: '' },
    paper: { type: String, default: '' },
    chapter: { type: String, default: '' },
    topic: { type: String, default: '' },
    source: {
      type: String,
      enum: ['qbank', 'board', 'varsity', 'contest', 'mock_test', 'other'],
      default: 'qbank'
    },
    // Student response
    selectedIndex: { type: Number, default: null },        // MCQ choice
    writtenImageBase64: { type: String, default: '' },     // written/CQ upload
    writtenText: { type: String, default: '' },             // future: typed answer
    isCorrect: { type: Boolean, default: null },           // null = ungraded
    isAttempted: { type: Boolean, default: false },
    // For MCQ: +1 / -0.25 (configurable). For written: AI score in [0..1]
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 1 },
    timeSpentSeconds: { type: Number, default: 0 },
    aiFeedback: { type: String, default: '' },
    flagged: { type: Boolean, default: false },
    answeredAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const practiceAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    mode: {
      type: String,
      enum: ['mock_test', 'qbank_practice', 'free_practice', 'inline_qbank'],
      required: true,
      index: true
    },

    // Optional link back to the source contest (if this attempt was a
    // mock test built on top of a Contest document)
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      default: null
    },

    // Display name (e.g. "HSC 2024 Physics 2nd Paper Mock 1")
    title: { type: String, default: '' },

    // Subject hierarchy — denormalized for fast filtering/aggregation
    subjects: { type: [String], default: [] },
    papers: { type: [String], default: [] },
    chapters: { type: [String], default: [] },
    topics: { type: [String], default: [] },

    // Test-level configuration
    config: {
      durationMinutes: { type: Number, default: 0 },
      totalMarks: { type: Number, default: 0 },
      negativeMarking: { type: Boolean, default: false },
      negativePenalty: { type: Number, default: 0.25 },
      passingMarks: { type: Number, default: 0 },
      questionCount: { type: Number, default: 0 }
    },

    // Per-question detail
    questions: { type: [perQuestionSchema], default: [] },

    // Aggregated marks
    marks: {
      obtained: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      written: { type: Number, default: 0 }
    },

    // Timing
    timing: {
      startedAt: { type: Date, default: Date.now },
      submittedAt: { type: Date, default: null },
      timeTakenSeconds: { type: Number, default: 0 },
      averageTimePerQuestion: { type: Number, default: 0 }
    },

    // Client metadata
    device: {
      userAgent: { type: String, default: '' },
      language: { type: String, default: '' }
    },

    // Free-form notes the student can attach after submission
    notes: { type: String, default: '', maxlength: 1000 },

    // Soft delete (we never hard-delete automatically)
    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

// Indexes for the most common queries
practiceAttemptSchema.index({ userId: 1, mode: 1, createdAt: -1 });
practiceAttemptSchema.index({ userId: 1, 'questions.subject': 1 });
practiceAttemptSchema.index({ userId: 1, 'questions.chapter': 1 });
practiceAttemptSchema.index({ userId: 1, 'marks.percentage': -1 });

/**
 * Compute aggregate marks from the per-question scores. Call this before
 * saving to keep `marks.*` in sync with `questions[]`.
 */
practiceAttemptSchema.methods.recomputeMarks = function () {
  let obtained = 0;
  let total = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let written = 0;

  for (const q of this.questions) {
    total += q.maxScore || 0;
    if (!q.isAttempted) {
      skipped += 1;
      continue;
    }
    if (q.snapshot.type === 'mcq') {
      if (q.isCorrect) correct += 1;
      else incorrect += 1;
    } else {
      written += 1;
    }
    obtained += q.score || 0;
  }

  this.marks = {
    obtained: Number(obtained.toFixed(4)),
    total: Number(total.toFixed(4)),
    percentage: total > 0 ? Number(((obtained / total) * 100).toFixed(2)) : 0,
    correct,
    incorrect,
    skipped,
    written
  };
};

module.exports = mongoose.model('PracticeAttempt', practiceAttemptSchema);
