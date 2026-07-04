const ApiResponse = require('../utils/apiResponse');
const upload = require('./upload');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Plan / subscription gate errors (thrown by services/planService.js and
  // middleware/requirePlan.js). Carry a machine-readable `code` + `feature`
  // so the client can show the right paywall / upgrade prompt.
  if (err.isPlanError) {
    return res.status(err.statusCode || 402).json({
      success: false,
      message: err.message,
      code: err.code,
      feature: err.feature || null,
      requiredPlan: err.requiredPlan || null
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return ApiResponse.error(res, 'Validation failed', 400, messages);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return ApiResponse.error(res, 'This email is already on the waitlist!', 409);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiResponse.error(res, 'Invalid ID format', 400);
  }

  // SyntaxError from express.json() — malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return ApiResponse.error(res, 'Invalid JSON in request body', 400);
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return ApiResponse.error(res, `File too large. Max size is ${upload.MAX_PDF_UPLOAD_MB}MB`, 413);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return ApiResponse.error(res, 'Unexpected file field', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 'Token expired', 401);
  }

  return ApiResponse.error(res, err.message || 'Internal Server Error', err.statusCode || 500);
};

module.exports = errorHandler;
