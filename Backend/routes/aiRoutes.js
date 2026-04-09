import { Router } from 'express';
import { chat, getHistory } from '../controllers/aiController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.post('/chat', optionalAuth, chat);
router.get('/history', requireAuth, getHistory);

export default router;
