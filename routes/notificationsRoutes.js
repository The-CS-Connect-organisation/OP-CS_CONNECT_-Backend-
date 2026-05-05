import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, createRecord, updateRecord, queryRecords } from '../utils/firebaseDb.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications?userId=
// Students/parents/teachers only see their own. Admins can query any userId.
router.get('/', asyncHandler(async (req, res) => {
  const targetUserId = req.query.userId || req.user.id;

  // Non-admins can only fetch their own notifications
  if (req.user.role !== 'admin' && targetUserId !== req.user.id) {
    throw new ApiError(403, 'Forbidden');
  }

  const notifications = await queryRecords('notifications', (n) => n.user_id === targetUserId);

  // Sort newest first
  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, notifications });
}));

// POST /api/notifications — create a notification
router.post('/', asyncHandler(async (req, res) => {
  const { userId, message, type = 'info', meta = {} } = req.body;

  if (!userId || !message) {
    throw new ApiError(400, 'userId and message are required');
  }

  // Only admins and teachers can create notifications for other users
  if (req.user.role !== 'admin' && req.user.role !== 'teacher' && userId !== req.user.id) {
    throw new ApiError(403, 'Forbidden');
  }

  const notification = await createRecord('notifications', {
    user_id: userId,
    message,
    type,
    meta,
    read: false,
    created_by: req.user.id,
  });

  // Push real-time via socket if available
  const io = req.io;
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  res.status(201).json({ success: true, notification });
}));

// POST /api/notifications/:notificationId/read — mark as read
router.post('/:notificationId/read', asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const existing = await getRecord(`notifications/${notificationId}`);
  if (!existing) throw new ApiError(404, 'Notification not found');

  // Users can only mark their own notifications as read
  if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  const updated = await updateRecord(`notifications/${notificationId}`, {
    ...existing,
    read: true,
    read_at: new Date().toISOString(),
  });

  res.json({ success: true, notification: updated });
}));

export default router;
