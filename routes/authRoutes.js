import { Router } from 'express';
import { login, me, signup, requestPasswordReset, verifyResetOtp, resetPassword } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, signupSchema } from '../validators/authValidators.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/health', me);
router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));
router.post('/signup', validateRequest(signupSchema), signup);
router.post('/login', validateRequest(loginSchema), login);

// Password Reset
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

export default router;
