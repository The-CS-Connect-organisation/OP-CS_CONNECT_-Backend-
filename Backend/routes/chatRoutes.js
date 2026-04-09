import { Router } from 'express';
import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';

const router = Router();

/**
 * POST /api/chat/token
 * Body: { userId: string }
 * Returns: { token: string }
 *
 * Generates a GetStream user token signed with the app secret.
 */
router.post('/token', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!env.STREAM_API_SECRET) {
      return res.status(503).json({
        error: 'STREAM_API_SECRET not configured. Use dev tokens on the client.',
      });
    }

    const serverClient = StreamChat.getInstance(
      env.STREAM_API_KEY,
      env.STREAM_API_SECRET
    );

    // Sanitize userId (GetStream accepts alphanum, _, -)
    const sanitized = userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
    const token = serverClient.createToken(sanitized);

    res.json({ token, userId: sanitized });
  } catch (err) {
    console.error('[Chat Token] Error:', err);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

export default router;
