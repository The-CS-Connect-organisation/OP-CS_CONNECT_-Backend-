import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRecord, updateRecord } from '../utils/firebaseDb.js';

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

export default router;
