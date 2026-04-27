import { Router } from 'express';
import { chat, getHistory } from '../controllers/aiController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
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

export default router;
