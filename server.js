import app, { setSocketServer } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { bootstrapDefaultUsers } from './seed/bootstrapDefaults.js';
import { verifyToken } from './utils/jwt.js';
import { trackConnect, trackDisconnect, trackRoom } from './utils/socket.js';

const dmRoomId = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `dm:${x}:${y}`;
};

let server;
let io;

const start = async () => {
  await connectDatabase();
  await bootstrapDefaultUsers();
  const httpServer = createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin === env.CORS_ORIGIN) return callback(null, true);
        if (env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });
  io.use((socket, next) => {
    socket.userId = null;
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = verifyToken(token);
        socket.userId = decoded.sub;
      } catch {
        logger.warn('Socket connected with invalid or expired JWT; treating as guest', {
          id: socket.id,
        });
      }
    }
    next();
  });
  io.on('connection', (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      trackConnect(socket.userId, socket.id);
      logger.info('Socket client connected', { id: socket.id, userId: socket.userId });
    } else {
      logger.info('Socket client connected (guest, no user room)', { id: socket.id });
    }
    socket.on('join:class', (classId) => {
      if (!socket.userId || !classId) return;
      socket.join(`class:${classId}`);
      trackRoom(socket.userId, classId);
    });
    // Online presence
    socket.on('user:online', (data) => {
      if (data?.userId) {
        socket.broadcast.emit('user:online', { userId: data.userId });
      }
    });
    socket.on('online:request', () => {
      // Send back list of currently connected users
      const onlineList = getConnectedUsers();
      socket.emit('online:list', { users: onlineList });
    });
    // Typing indicators — relay to the target user
    socket.on('typing:start', ({ toUserId }) => {
      if (!socket.userId || !toUserId) return;
      const sanitized = String(toUserId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
      socket.to(`user:${sanitized}`).emit('typing:start', { userId: socket.userId });
    });
    socket.on('typing:stop', ({ toUserId }) => {
      if (!socket.userId || !toUserId) return;
      const sanitized = String(toUserId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
      socket.to(`user:${sanitized}`).emit('typing:stop', { userId: socket.userId });
    });
    socket.on('call:join', ({ peerId }) => {
      if (!socket.userId || !peerId) return;
      const room = dmRoomId(socket.userId, peerId);
      socket.join(room);
      socket.to(room).emit('call:peer-joined', { peerId: socket.userId });
    });
    socket.on('call:signal', ({ peerId, type, payload }) => {
      if (!socket.userId || !peerId || !type) return;
      // Sanitize peerId the same way the frontend does
      const sanitizedPeerId = String(peerId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
      // Emit directly to the peer's user room — no need for call:join
      socket.to(`user:${sanitizedPeerId}`).emit('call:signal', {
        fromUserId: socket.userId,
        type,
        payload,
        timestamp: new Date().toISOString()
      });
      // Also try the DM room as fallback
      const room = dmRoomId(socket.userId, sanitizedPeerId);
      socket.to(room).emit('call:signal', {
        fromUserId: socket.userId,
        type,
        payload,
        timestamp: new Date().toISOString()
      });
    });
    socket.on('disconnect', () => {
      if (socket.userId) {
        socket.broadcast.emit('user:offline', { userId: socket.userId });
      }
      trackDisconnect(socket.userId);
      logger.info('Socket client disconnected', { id: socket.id });
    });
  });
  setSocketServer(io);
  const port = env.PORT || 5000;
  server = httpServer.listen(port, () => {
    logger.info(`API server running on port ${port}`);
  });
};

const shutdown = async (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (io) io.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  logger.error('Failed to start API server', { message: error.message });
  process.exit(1);
});
