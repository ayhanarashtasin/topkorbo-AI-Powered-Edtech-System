const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // JWT auth on the handshake
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) {
        // Allow anonymous socket connections (e.g. browsing public feed)
        socket.userId = null;
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      socket.userRole = decoded.role || 'student';
      socket.forumRole = decoded.forumRole || 'user';
      next();
    } catch (err) {
      socket.userId = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    // Auto-join personal room for authenticated users
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    socket.on('join:post', (postId) => {
      if (postId) socket.join(`post:${String(postId)}`);
    });
    socket.on('leave:post', (postId) => {
      if (postId) socket.leave(`post:${String(postId)}`);
    });

    socket.on('join:contest', async (contestId) => {
      console.log(`[Socket] User ${socket.userId} joining contest room: contest:${contestId}`);
      if (contestId) {
        socket.join(`contest:${String(contestId)}`);
        try {
          const ContestResult = require('../models/ContestResult');
          const top3 = await ContestResult.find({ contest: contestId })
            .sort({ answersSubmitted: -1, updatedAt: 1 })
            .limit(3)
            .populate('student', 'name')
            .lean();
          console.log(`[Socket] Emitting initial leaderboard for contest ${contestId}:`, JSON.stringify(top3));
          socket.emit('contest:leaderboard', top3);
        } catch (err) {
          console.error('Error fetching initial contest leaderboard:', err);
        }
      }
    });
    socket.on('leave:contest', (contestId) => {
      if (contestId) socket.leave(`contest:${String(contestId)}`);
    });

    socket.on('typing:start', ({ postId }) => {
      if (!postId || !socket.userId) return;
      socket.to(`post:${String(postId)}`).emit('typing:update', {
        userId: socket.userId,
        isTyping: true
      });
    });
    socket.on('typing:stop', ({ postId }) => {
      if (!postId || !socket.userId) return;
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

module.exports = { initSocket, getIO };
