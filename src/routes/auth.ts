import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = await listData('users');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ success: true, user: safeUser(user), token: `token_${user.id}_${Date.now()}` });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'student' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUsers = await listData('users');
    if (existingUsers.some(u => u.email === email)) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const userId = id('user');
    const newUser = {
      id: userId,
      email,
      password,
      name,
      role,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    await setData(`users/${userId}`, newUser);
    res.json({ success: true, user: safeUser(newUser), token: `token_${userId}_${Date.now()}` });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const users = await listData('users');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setData(`password_resets/${user.id}`, {
      userId: user.id,
      otp,
      expiresAt: Date.now() + 3600000 // 1 hour
    });

    res.json({ success: true, message: 'OTP sent to your email', otp: process.env.NODE_ENV === 'development' ? otp : undefined });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const users = await listData('users');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetData = await getData(`password_resets/${user.id}`);
    if (!resetData || resetData.otp !== otp || resetData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('[Auth] Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const users = await listData('users');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetData = await getData(`password_resets/${user.id}`);
    if (!resetData || resetData.otp !== otp || resetData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await setData(`users/${user.id}`, { ...user, password: newPassword });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const user = await getData(`users/${userId}`);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;