const ApiResponse = require('../utils/apiResponse');
const upload = require('./upload');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Plan / subscription gate errors (thrown by services/planService.js and
  // middleware/requirePlan.js). These are EXPECTED business responses (the
  // client shows a paywall / upgrade prompt), not server faults — so we return
  // them without logging, to keep the terminal clean. Carry a machine-readable
  // `code` + `feature` so the client can show the right prompt.
  if (err.isPlanError) {
    return res.status(err.statusCode || 402).json({
      success: false,
      message: err.message,
      code: err.code,
      feature: err.feature || null,
      requiredPlan: err.requiredPlan || null
    });
  }

  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return ApiResponse.error(res, 'Validation failed', 400, messages);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const collection = String(err.collection || '');
    const keyPattern = err.keyPattern || {};

    if (req.path === '/api/landing/waitlist' || collection.includes('waitlist')) {
      return ApiResponse.error(res, 'This email is already on the waitlist!', 409);
    }

    if (req.path.startsWith('/api/payments') || collection.includes('payment')) {
      return ApiResponse.error(res, 'Payment request already exists. Please try again.', 409);
    }

    if (keyPattern.email) {
      return ApiResponse.error(res, 'This email is already registered.', 409);
    }

    return ApiResponse.error(res, 'Duplicate record already exists.', 409);
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
    if (/^\/api\/users\/me/.test(req.originalUrl || '')) {
      return ApiResponse.error(res, 'Avatar too large. Avatars are limited to 2MB.', 413);
    }
    if (/^\/api\/(?:posts|comments)/.test(req.originalUrl || '')) {
      return ApiResponse.error(res, 'Image too large. Forum images are limited to 4MB.', 413);
    }
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

  // Known client errors (4xx) may surface their message; anything 500+ must NOT
  // leak internal/upstream details to the client in production.
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    return ApiResponse.error(res, 'Internal Server Error', 500);
  }
  return ApiResponse.error(res, err.message || 'Internal Server Error', statusCode);
};

module.exports = errorHandler;
