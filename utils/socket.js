/**
 * Socket.IO utility — stores the IO instance and exposes emit helpers.
 * The actual connection handler lives in server.js (JWT auth, rooms, calls).
 */

let ioInstance = null;
const connectedUsers = new Map();
const userRooms = new Map();

/**
 * Set the Socket.IO server instance (called once from server.js after setup).
 */
export const setIO = (io) => {
  ioInstance = io;
};

/**
 * Get the Socket.IO server instance.
 */
export const getIO = () => ioInstance;

// ── Emit helpers ────────────────────────────────────────────────────────────

export const emitToRoom = (room, event, data) => {
  if (ioInstance) ioInstance.to(room).emit(event, data);
};

export const emitToUser = (userId, event, data) => {
  if (ioInstance) ioInstance.to(`user:${userId}`).emit(event, data);
};

export const emitToClass = (classId, event, data) => {
  if (ioInstance) ioInstance.to(`class:${classId}`).emit(event, data);
};

export const broadcast = (event, data) => {
  if (ioInstance) ioInstance.emit(event, data);
};

export const emitToUsers = (userIds, event, data) => {
  if (!ioInstance) return;
  userIds.forEach(userId => ioInstance.to(`user:${userId}`).emit(event, data));
};

export const emitToClasses = (classIds, event, data) => {
  if (!ioInstance) return;
  classIds.forEach(classId => ioInstance.to(`class:${classId}`).emit(event, data));
};

// ── Connected-user tracking (updated by server.js via trackConnect/trackDisconnect) ──

export const trackConnect = (userId, socketId) => {
  if (userId) connectedUsers.set(userId, socketId);
};

export const trackDisconnect = (userId) => {
  connectedUsers.delete(userId);
  userRooms.delete(userId);
};

export const trackRoom = (userId, classId) => {
  if (!userRooms.has(userId)) userRooms.set(userId, new Set());
  userRooms.get(userId).add(classId);
};

export const isUserOnline = (userId) => connectedUsers.has(userId);
export const getConnectedUsers = () => Array.from(connectedUsers.keys());
export const getConnectedUsersCount = () => connectedUsers.size;
export const getUserSocketId = (userId) => connectedUsers.get(userId);
export const getUserRooms = (userId) => Array.from(userRooms.get(userId) || []);
