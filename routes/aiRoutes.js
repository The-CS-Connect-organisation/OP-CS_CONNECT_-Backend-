import { Router } from 'express';
import { chat, getHistory, getAiStats, getAiTools, getRecentQueries } from '../controllers/aiController.js';
import { requireAuth, optionalAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

const chatSchema = z.object({
  body: z.object({
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(10000),
      })
    ).min(1).max(50),
    mode: z.enum(['balanced', 'advanced']).optional(),
  }),
});

router.post('/chat', optionalAuth, validateRequest(chatSchema), chat);
router.get('/history', requireAuth, getHistory);
router.get('/stats', allowRoles('admin'), getAiStats);
router.get('/tools', allowRoles('admin'), getAiTools);
router.get('/recent-queries', allowRoles('admin'), getRecentQueries);

export default router;
