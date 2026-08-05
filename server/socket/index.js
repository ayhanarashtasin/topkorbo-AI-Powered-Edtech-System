/**
 * Socket.IO server setup — real-time communication layer for the forum.
 *
 * Responsibilities:
 *  - CORS origin validation matching the REST API config
 *  - JWT-based handshake authentication (anonymous users allowed for public features)
 *  - Room management: per-user rooms, post discussion rooms, contest live rooms
 *  - Typing indicator broadcast within post rooms
 *  - Redis adapter integration for horizontal scaling across server instances
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { configureSocketAdapter } = require('../config/redis');
const User = require('../models/User');
const Post = require('../models/Post');
const {
  resolveAccountStatus,
  reactivateExpiredBan
} = require('../services/accountStatusService');

let io = null;

// Mirrors the CORS origin allowlist used in server.js so WebSocket connections
// are subject to the same origin restrictions as HTTP requests.
function buildOriginAllowlist() {
  const port = process.env.PORT || 5000;
  return [
    process.env.FRONTEND_URL,
    process.env.SERVER_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '',
    ...(process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          `http://localhost:${port}`,
          `http://127.0.0.1:${port}`
        ])
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);
}

/**
 * Middleware applied to every incoming socket handshake.
 *
 * Extracts the JWT from auth.token or the Authorization header, verifies it,
 * and attaches userId / userRole / forumRole to the socket for downstream use.
 * Anonymous connections (no token) are allowed through with userId=null so they
 * can access public features like contest leaderboards without authentication.
 */
async function authenticateSocketHandshake(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      socket.userId = null;
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.id).select(
      '_id role forumRole isBanned accountStatus banExpiresAt'
    );
    if (!user) return next(new Error('Unauthorized'));

    // Reactivate bans that have passed their expiry before checking status.
    user = await reactivateExpiredBan(user);
    if (resolveAccountStatus(user) !== 'active') {
      return next(new Error('Account unavailable'));
    }

    socket.userId = String(user._id);
    socket.userRole = user.role || 'student';
    socket.forumRole = user.forumRole || 'user';
    return next();
  } catch (_err) {
    return next(new Error('Unauthorized'));
  }
}

/**
 * Initialise the Socket.IO server on top of the existing HTTP server.
 *
 * Sets up CORS, attaches the Redis adapter for multi-instance deployments,
 * registers the auth middleware, and wires up connection/event handlers.
 */
function initSocket(httpServer) {
  const allowlist = buildOriginAllowlist();
  io = new Server(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin || allowlist.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('Origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // Redis adapter enables broadcasting across multiple server processes.
  configureSocketAdapter(io)
    .then((configured) => {
      if (configured) console.log('Socket.IO Redis adapter connected');
    })
    .catch((error) => {
      console.error('Socket.IO Redis adapter failed:', error.message);
    });

  // Every connection must pass authentication before reaching event handlers.
  io.use(authenticateSocketHandshake);

  io.on('connection', (socket) => {
    // Authenticated users automatically join their personal room (for targeted
    // notifications) and the global "forum" room (for site-wide broadcasts).
    if (socket.userId) {
      socket.join('forum');
      socket.join(`user:${socket.userId}`);
    }

    // --- Post room management ------------------------------------------------
    // Users join a post room to receive live comment updates and typing
    // indicators for that specific thread. Hidden posts are only accessible
    // to the author and moderators/admins.
    socket.on('join:post', async (postId) => {
      if (!socket.userId || !postId || !mongoose.isValidObjectId(postId)) return;
      const post = await Post.findById(postId).select('author isHidden').lean().catch(() => null);
      if (!post) return;
      const canSeeHidden =
        String(post.author) === socket.userId ||
        ['moderator', 'admin'].includes(socket.forumRole);
      if (post.isHidden && !canSeeHidden) return;
      socket.join(`post:${String(postId)}`);
    });
    socket.on('leave:post', (postId) => {
      if (postId && mongoose.isValidObjectId(postId)) {
        socket.leave(`post:${String(postId)}`);
      }
    });

    // --- Contest room management ---------------------------------------------
    // Contest rooms push live leaderboard updates to viewers. The initial
    // leaderboard is sent immediately on join so the client doesn't have to
    // poll for the current state.
    socket.on('join:contest', async (contestId) => {
      // Validate the id before it reaches a Mongo query to avoid cast errors and
      // query amplification from malformed/abusive room-join spam.
      if (!contestId || !mongoose.isValidObjectId(contestId)) return;
      socket.join(`contest:${String(contestId)}`);
      {
        try {
          const { buildLiveLeaderboard } = require('../services/contestSettlementService');
          const board = await buildLiveLeaderboard(contestId, 10);
          socket.emit('contest:leaderboard', board);
        } catch (err) {
          console.error('Error fetching initial contest leaderboard:', err);
        }
      }
    });
    socket.on('leave:contest', (contestId) => {
      if (contestId) socket.leave(`contest:${String(contestId)}`);
    });

    // --- Typing indicators ---------------------------------------------------
    // Broadcasts a ephemeral "user is typing" event to everyone else in the
    // post room. Only works if the sender is actually in that room.
    socket.on('typing:start', ({ postId } = {}) => {
      if (!postId || !socket.userId || !socket.rooms.has(`post:${String(postId)}`)) return;
      socket.to(`post:${String(postId)}`).emit('typing:update', {
        userId: socket.userId,
        isTyping: true
      });
    });
    socket.on('typing:stop', ({ postId } = {}) => {
      if (!postId || !socket.userId || !socket.rooms.has(`post:${String(postId)}`)) return;
      socket.to(`post:${String(postId)}`).emit('typing:update', {
        userId: socket.userId,
        isTyping: false
      });
    });
  });

  return io;
}

/**
 * Returns the singleton Socket.IO instance.
 * Throws if initSocket() has not been called yet.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialised — call initSocket() first.');
  }
  return io;
}

module.exports = { initSocket, getIO, authenticateSocketHandshake, buildOriginAllowlist };
