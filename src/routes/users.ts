import { Router } from 'express';

const router = Router();

// GET /api/users
router.get('/', (req, res) => {
  res.json({ message: 'Get users endpoint not implemented yet' });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  res.json({ message: `Get user ${req.params.id} endpoint not implemented yet` });
});

// POST /api/users
router.post('/', (req, res) => {
  res.json({ message: 'Create user endpoint not implemented yet' });
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  res.json({ message: `Update user ${req.params.id} endpoint not implemented yet` });
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  res.json({ message: `Delete user ${req.params.id} endpoint not implemented yet` });
});

// PUT /api/users/:userId/avatar
router.put('/:userId/avatar', (req, res) => {
    res.json({ message: `Update user avatar for ${req.params.userId} endpoint not implemented yet` });
});

export default router;