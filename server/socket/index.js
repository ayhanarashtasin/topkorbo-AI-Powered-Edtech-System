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