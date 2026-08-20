const ProctorViolation = require('../models/ProctorViolation');
const ContestResult = require('../models/ContestResult');
const ApiResponse = require('../utils/apiResponse');
const { cloudinary, isCloudinaryEnabled } = require('../config/cloudinary');

let getIO;
try {
  getIO = require('../socket').getIO;
} catch (error) {
  // Graceful fallback if socket isn't implemented yet
  getIO = null;
}

exports.logViolation = async (req, res, next) => {
  try {
    const { id: contestId } = req.params;
    const studentId = req.user.id;
    const { violationType, confidence, image, questionIndex } = req.body;

    if (!contestId || !image) {
      return ApiResponse.error(res, 'Contest ID and image are required', 400);
    }

    let snapshotUrl = image;
    // Attempt Cloudinary upload if it's base64 and cloudinary is enabled
    if (image.startsWith('data:image') && isCloudinaryEnabled) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(image, {
          folder: 'topkorbo/proctoring',
          resource_type: 'image'
        });
        snapshotUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Fallback to storing first 500 chars if upload fails
        snapshotUrl = image.substring(0, 500); 
      }
    } else if (image.startsWith('data:image')) {
       // If no cloudinary, truncate the base64 or keep it
       snapshotUrl = image; // Keeping it as requested, but might be large
    }

    const violation = await ProctorViolation.create({
      contestId,
      studentId,
      violationType: violationType || 'MOBILE_PHONE_DETECTED',
      confidence,
      snapshotUrl,
      questionIndex: questionIndex || 0
    });

    const totalViolations = await ProctorViolation.countDocuments({ contestId, studentId });

    if (totalViolations >= 3) {
      await ContestResult.findOneAndUpdate(
        { contest: contestId, student: studentId },
        { 
          antiCheatStatus: 'flagged',
          antiCheatReason: `AI proctor: ${violation.violationType} detected ${totalViolations} times`
        }
      );
    }

    if (getIO) {
      try {
        const io = getIO();
        io.to(`contest:${contestId}`).emit('proctor:violation', {
          studentId,
          violationType: violation.violationType,
          confidence,
          timestamp: violation.timestamp,
          totalViolations
        });
      } catch (ioError) {
        console.error('Socket IO error:', ioError);
      }
    }

    return ApiResponse.success(res, {
      violationId: violation._id,
      totalViolations
    }, 'Violation logged successfully');
  } catch (error) {
    next(error);
  }
};

exports.getViolations = async (req, res, next) => {
  try {
    const { id: contestId } = req.params;
    const { page = 1, limit = 20, studentId } = req.query;

    const query = { contestId };
    if (studentId) {
      query.studentId = studentId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const violations = await ProctorViolation.find(query)
      .populate('studentId', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ProctorViolation.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(res, {
      items: violations,
      pagination: {
        page: parseInt(page),
        totalPages,
        total
      }
    }, 'Violations retrieved successfully');
  } catch (error) {
    next(error);
  }
};

exports.reviewViolation = async (req, res, next) => {
  try {
    const { violationId } = req.params;
    const { status, reviewNote } = req.body;
    const reviewerId = req.user.id;

    if (!['confirmed_cheating', 'dismissed_false_positive'].includes(status)) {
      return ApiResponse.error(res, 'Invalid status', 400);
    }

    const violation = await ProctorViolation.findByIdAndUpdate(
      violationId,
      {
        status,
        reviewNote: reviewNote || '',
        reviewedBy: reviewerId
      },
      { new: true }
    );

    if (!violation) {
      return ApiResponse.error(res, 'Violation not found', 404);
    }

    if (status === 'confirmed_cheating') {
      await ContestResult.findOneAndUpdate(
        { contest: violation.contestId, student: violation.studentId },
        {
          isDisqualified: true,
          disqualificationReason: 'Confirmed cheating: mobile phone detected during exam',
          antiCheatStatus: 'flagged'
        }
      );
    }

    return ApiResponse.success(res, violation, 'Violation reviewed successfully');
  } catch (error) {
    next(error);
  }
};
