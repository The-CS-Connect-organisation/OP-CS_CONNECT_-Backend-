import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { getData, setData, listData, id, safeUser, removeData } from '../firebase';

const SALT_ROUNDS = 10;
const router = Router();

// GET /api/users
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!requester || !['admin', 'principal'].includes(requester.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const users = await listData('users');
    res.json({ success: true, users: users.map(safeUser) });
  } catch (err) {
    console.error('[Users] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const user = await getData(`users/${id}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (requesterId !== id && !['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    console.error('[Users] Get single error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!requester || !['admin', 'principal'].includes(requester.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { email, password, name, role = 'student', ...rest } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUsers = await listData('users');
    if (existingUsers.some(u => u.email === email)) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = id('user');
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      role,
      ...rest,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    await setData(`users/${userId}`, newUser);
    res.json({ success: true, user: safeUser(newUser) });
  } catch (err) {
    console.error('[Users] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const existingUser = await getData(`users/${id}`);
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (requesterId !== id && !['admin', 'principal'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { password, email, ...updates } = req.body;
    const updatedUser = { ...existingUser, ...updates };
    
    if (email && email !== existingUser.email) {
      const existingUsers = await listData('users');
      if (existingUsers.some(u => u.email === email && u.id !== id)) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      updatedUser.email = email;
    }
    
    if (password) {
      updatedUser.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    await setData(`users/${id}`, updatedUser);
    res.json({ success: true, user: safeUser(updatedUser) });
  } catch (err) {
    console.error('[Users] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!requester || !['admin', 'principal'].includes(requester.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const user = await getData(`users/${id}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await removeData(`users/${id}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[Users] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:userId/avatar
router.put('/:userId/avatar', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { userId } = req.params;
    const user = await getData(`users/${userId}`);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (requesterId !== userId) {
      return res.status(403).json({ error: 'Forbidden - You can only update your own avatar' });
    }

    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ error: 'Avatar URL is required' });
    }

    const updatedUser = { ...user, avatarUrl };
    await setData(`users/${userId}`, updatedUser);
    
    res.json({ success: true, user: safeUser(updatedUser) });
  } catch (err) {
    console.error('[Users] Update avatar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;