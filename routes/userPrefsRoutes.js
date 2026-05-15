import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRecord, updateRecord } from '../utils/firebaseDb.js';
import { sendFCMPush } from '../services/notificationFallbackService.js';

const router = Router();
router.use(requireAuth);

// GET /api/user-prefs/stars
router.get('/stars', asyncHandler(async (req, res) => {
  const prefs = await getRecord(`user_prefs/${req.user.id}`);
  res.json({ success: true, stars: prefs?.stars || [] });
}));

// PUT /api/user-prefs/stars
router.put('/stars', asyncHandler(async (req, res) => {
  const { stars } = req.body;
  if (!Array.isArray(stars)) {
    return res.status(400).json({ success: false, message: 'stars must be an array' });
  }
  await updateRecord(`user_prefs/${req.user.id}`, { stars, updated_at: new Date().toISOString() });
  res.json({ success: true, stars });
}));

// GET /api/user-prefs/notification-settings
router.get('/notification-settings', asyncHandler(async (req, res) => {
  const prefs = await getRecord(`user_prefs/${req.user.id}`);
  res.json({
    success: true,
    notificationPrefs: prefs?.notification_prefs || {
      push_notifications: true,
      email_notifications: true,
      fcm_token: null,
    },
  });
}));

// PUT /api/user-prefs/notification-settings
router.put('/notification-settings', asyncHandler(async (req, res) => {
  const { push_notifications, email_notifications, fcm_token } = req.body;
  const prefs = await getRecord(`user_prefs/${req.user.id}`) || {};

  const updated = {
    ...prefs.notification_prefs,
    ...(push_notifications !== undefined && { push_notifications }),
    ...(email_notifications !== undefined && { email_notifications }),
    ...(fcm_token !== undefined && { fcm_token }),
  };

  await updateRecord(`user_prefs/${req.user.id}`, {
    notification_prefs: updated,
    updated_at: new Date().toISOString(),
  });
  res.json({ success: true, notificationPrefs: updated });
}));

// POST /api/user-prefs/fcm-token
router.post('/fcm-token', asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'FCM token is required' });
  }

  await updateRecord(`users/${req.user.id}`, {
    fcm_token: token,
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, message: 'FCM token saved' });
}));

// POST /api/user-prefs/test-push
router.post('/test-push', asyncHandler(async (req, res) => {
  const { sendFCMPush: sendPush } = await import('../services/notificationFallbackService.js');
  const result = await sendPush(req.user.id, 'Test Notification', 'This is a test push notification from SchoolSync.');
  res.json(result);
}));

export default router;
