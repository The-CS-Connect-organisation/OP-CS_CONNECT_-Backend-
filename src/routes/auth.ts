import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getData, setData, removeData, safeUser } from '../firebase';

const router = Router();
const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'eduvault-dev-secret';
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function signToken(user: any): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
}

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const usersData = await getData('users') as any;
    if (!usersData) return res.status(401).json({ error: 'Invalid credentials' });
    
    const entries = Object.entries(usersData) as [string, any][];
    const entry = entries.find(([_, u]) => u.email === email);
    if (!entry) return res.status(401).json({ error: 'Invalid credentials' });
    
    const [userKey, user] = entry;
    let valid = false;
    
    if (user.password && user.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = password === user.password;
      if (valid) {
        user.password = await bcrypt.hash(password, SALT_ROUNDS);
        await setData(`users/${userKey}`, { ...user });
      }
    }
    
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user: safeUser(user), token: signToken(user) });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, class: className,
      subjects, rollNo, admissionNo, phone, address, dateOfBirth,
      bloodGroup, aadharNo, penNo, apaarId, religion, nationality,
      schoolHouse, houseLocation, fatherName, fatherPhone, motherName, motherPhone } = req.body;
    const usersData = await getData('users') as any;
    const users = usersData ? Object.values(usersData) : [];
    const existing = users.find((u: any) => u.email === email);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser: Record<string, any> = {
      id: `u${Date.now()}`,
      name,
      email,
      password: hashedPassword,
      role: role || 'student',
      class: className || '',
      avatar: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      createdAt: new Date().toISOString()
    };

    // Teacher-specific fields
    if (role === 'teacher') {
      if (subjects) newUser.subjects = subjects;
      if (className) newUser.classes = [className];
    }
    // Student-specific fields
    if (role === 'parent') {
      const { parentType } = req.body;
      if (phone) newUser.phone = phone;
      if (parentType) newUser.parentType = parentType;
    }
    if (role === 'student') {
      if (subjects) newUser.subjects = subjects;
      if (rollNo) newUser.rollNo = rollNo;
      if (admissionNo) newUser.admissionNo = admissionNo;
      if (phone) newUser.phone = phone;
      if (address) newUser.address = address;
      if (dateOfBirth) newUser.dateOfBirth = dateOfBirth;
      if (bloodGroup) newUser.bloodGroup = bloodGroup;
      if (aadharNo) newUser.aadharNo = aadharNo;
      if (penNo) newUser.penNo = penNo;
      if (apaarId) newUser.apaarId = apaarId;
      if (religion) newUser.religion = religion;
      if (nationality) newUser.nationality = nationality;
      if (schoolHouse) newUser.schoolHouse = schoolHouse;
      if (houseLocation) newUser.houseLocation = houseLocation;
      if (fatherName) newUser.fatherName = fatherName;
      if (fatherPhone) newUser.fatherPhone = fatherPhone;
      if (motherName) newUser.motherName = motherName;
      if (motherPhone) newUser.motherPhone = motherPhone;
    }
    
    await setData(`users/${newUser.id}`, newUser);
    res.status(201).json({ user: safeUser(newUser), token: signToken(newUser) });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    // Always return the same message regardless of whether the email exists (prevents enumeration)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setData(`otpStore/${email}`, { otp, expiresAt: Date.now() + 300000 });
    // In production, replace with actual email/SMS sending
    console.log(`[Forgot Password] OTP for ${email}: ${otp}`);
    res.json({ message: 'If this email is registered, an OTP has been sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/verify-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const otpData = await getData(`otpStore/${email}`);
    if (!otpData || otpData.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ error: 'OTP expired' });
    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpData = await getData(`otpStore/${email}`);
    if (!otpData || otpData.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    if (Date.now() > otpData.expiresAt) return res.status(400).json({ error: 'OTP expired' });
    
    const usersData = await getData('users') as any;
    const userKey = Object.keys(usersData).find((k: string) => usersData[k].email === email);
    if (!userKey) return res.status(404).json({ error: 'User not found' });
    
    const user = usersData[userKey];
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await setData(`users/${userKey}`, { ...user, password: hashedPassword });
    await removeData(`otpStore/${email}`);
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.id;
      } catch { /* fall through */ }
    }
    if (!userId) {
      userId = req.headers['x-user-id'] as string;
    }
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const user = await getData(`users/${userId}`);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
