import { Router } from 'express';
import { login, me, signup, requestPasswordReset, verifyResetOtp, resetPassword } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, signupSchema } from '../validators/authValidators.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queryRecords, updateRecord } from '../utils/firebaseDb.js';
import pkg from 'bcryptjs';
const { hash } = pkg;

const router = Router();

router.get('/health', me);
router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));
router.post('/signup', validateRequest(signupSchema), signup);
router.post('/login', validateRequest(loginSchema), login);

// Password Reset
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// One-time seed endpoint - creates missing demo users
router.post('/seed-demo-users', asyncHandler(async (req, res) => {
  const demoUsers = [
    { name: 'Rajesh Kumar',  email: 'driver@schoolsync.edu',  role: 'driver',  password: 'driver123' },
    { name: 'Suresh Patel',  email: 'driver2@schoolsync.edu', role: 'driver',  password: 'driver123' },
    { name: 'Mohan Singh',   email: 'driver3@schoolsync.edu', role: 'driver',  password: 'driver123' },
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu',   role: 'admin',   password: 'admin123'  },
    { name: 'James Anderson',email: 'james@schoolsync.edu',   role: 'teacher', password: 'teacher123'},
    { name: 'Aarav Menon',   email: 'alex@schoolsync.edu',    role: 'student', password: 'student123'},
  ];

  const created = [];
  const skipped = [];

  for (const u of demoUsers) {
    const existing = await queryRecords('users', (x) => x.email === u.email);
    if (existing.length > 0) {
      skipped.push(u.email);
      continue;
    }
    const passwordHash = await hash(u.password, 12);
    const userId = `${u.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await updateRecord(`users/${userId}`, {
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      is_active: true,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    created.push(u.email);
  }

  res.json({ success: true, created, skipped });
}));

export default router;
