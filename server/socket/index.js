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

// Same allowlist strategy as the REST CORS config in server.js.
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

  configureSocketAdapter(io)
    .then((configured) => {
      if (configured) console.log('Socket.IO Redis adapter connected');
    })
    .catch((error) => {
      console.error('Socket.IO Redis adapter failed:', error.message);
    });

  // JWT auth on the handshake
  // Anonymous sockets may still use public, non-forum features such as
  // contest leaderboards, but never receive forum or personal events.
  io.use(authenticateSocketHandshake);

  io.on('connection', (socket) => {
    // Auto-join personal room for authenticated users
    if (socket.userId) {
      socket.join('forum');
      socket.join(`user:${socket.userId}`);
    }

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

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialised — call initSocket() first.');
  }
  return io;
}

module.exports = { initSocket, getIO, authenticateSocketHandshake, buildOriginAllowlist };
