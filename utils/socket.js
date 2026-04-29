/**
 * Socket.IO utility for accessing the IO instance across the application
 * Provides real-time WebSocket communication for dynamic updates
 */

let ioInstance = null;
const connectedUsers = new Map();
const userRooms = new Map();

/**
 * Set the Socket.IO server instance
 * @param {Server} io - Socket.IO server instance
 */
export const setIO = (io) => {
  ioInstance = io;
  setupSocketHandlers(io);
};

/**
 * Get the Socket.IO server instance
 * @returns {Server|null} Socket.IO server instance
 */
export const getIO = () => {
  return ioInstance;
};

/**
 * Setup Socket.IO event handlers
 */
const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    // Track connected user
    const userId = socket.handshake.auth?.userId;
    if (userId) {
      connectedUsers.set(userId, socket.id);
    }
    
    // Handle user joining
    socket.on('user:join', (data) => {
      const { userId, classIds = [] } = data;
      
      // Join user room
      socket.join(`user:${userId}`);
      
      // Join class rooms
      classIds.forEach(classId => {
        socket.join(`class:${classId}`);
        if (!userRooms.has(userId)) {
          userRooms.set(userId, new Set());
        }
        userRooms.get(userId).add(classId);
      });
      
      // Notify others that user is online
      io.emit('user:online', { userId, timestamp: new Date().toISOString() });
    });
    
    // Handle user leaving
    socket.on('user:leave', (data) => {
      const { userId } = data;
      connectedUsers.delete(userId);
      userRooms.delete(userId);
      io.emit('user:offline', { userId, timestamp: new Date().toISOString() });
    });
    
    // Handle real-time attendance updates
    socket.on('attendance:update', (data) => {
      const { classId, studentId, status } = data;
      io.to(`class:${classId}`).emit('attendance:updated', {
        classId,
        studentId,
        status,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle real-time grade updates
    socket.on('grade:update', (data) => {
      const { submissionId, marks, feedback } = data;
      io.emit('grade:updated', {
        submissionId,
        marks,
        feedback,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle real-time message delivery status
    socket.on('message:delivered', (data) => {
      const { messageId, recipientId } = data;
      io.to(`user:${data.senderId}`).emit('message:delivered', {
        messageId,
        recipientId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle real-time message read status
    socket.on('message:read', (data) => {
      const { messageId, recipientId, senderId } = data;
      io.to(`user:${senderId}`).emit('message:read', {
        messageId,
        recipientId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle real-time notification delivery
    socket.on('notification:delivered', (data) => {
      const { notificationId, userId } = data;
      io.to(`user:${userId}`).emit('notification:delivered', {
        notificationId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle real-time analytics updates
    socket.on('analytics:request', (data) => {
      const { classId } = data;
      io.to(`class:${classId}`).emit('analytics:update', {
        classId,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle keyboard shortcut tracking
    socket.on('shortcut:used', (data) => {
      const { userId, action } = data;
      io.to(`user:${userId}`).emit('shortcut:tracked', {
        action,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      if (userId) {
        connectedUsers.delete(userId);
        userRooms.delete(userId);
        io.emit('user:offline', { userId, timestamp: new Date().toISOString() });
      }
    });
  });
};

/**
 * Emit an event to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const emitToRoom = (room, event, data) => {
  if (ioInstance) {
    ioInstance.to(room).emit(event, data);
  }
};

/**
 * Emit an event to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const emitToUser = (userId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit an event to a class
 * @param {string} classId - Class ID
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const emitToClass = (classId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`class:${classId}`).emit(event, data);
  }
};

/**
 * Broadcast an event to all connected clients
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
export const broadcast = (event, data) => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
};

/**
 * Get connected users count
 */
export const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Get user's socket ID
 */
export const getUserSocketId = (userId) => {
  return connectedUsers.get(userId);
};

/**
 * Check if user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

/**
 * Get all connected users
 */
export const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

/**
 * Get user's rooms
 */
export const getUserRooms = (userId) => {
  return Array.from(userRooms.get(userId) || []);
};

/**
 * Emit to multiple users
 */
export const emitToUsers = (userIds, event, data) => {
  if (ioInstance) {
    userIds.forEach(userId => {
      ioInstance.to(`user:${userId}`).emit(event, data);
    });
  }
};

/**
 * Emit to multiple classes
 */
export const emitToClasses = (classIds, event, data) => {
  if (ioInstance) {
    classIds.forEach(classId => {
      ioInstance.to(`class:${classId}`).emit(event, data);
    });
  }
};