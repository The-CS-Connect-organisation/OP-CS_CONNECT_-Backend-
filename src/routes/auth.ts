import { Router, Request, Response } from 'express';
import { getData, setData } from '../firebase';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const users = (await getData('users')) as Record<string, any>;
    const user = Object.values(users || {}).find((u: any) => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'eduvault-secret', { expiresIn: '24h' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(req.body.password, 10);
    const newUser = { ...req.body, id: `u${Date.now()}`, password: hashed };
    await setData(`users/${newUser.id}`, newUser);
    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
