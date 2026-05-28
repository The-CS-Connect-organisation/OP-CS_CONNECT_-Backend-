import { Router } from 'express';

const router = Router();

// GET /api/clubs
router.get('/', (req, res) => {
    res.json({ message: 'Get clubs endpoint not implemented yet' });
});

// POST /api/clubs
router.post('/', (req, res) => {
    res.json({ message: 'Create club endpoint not implemented yet' });
});

// POST /api/clubs/:clubId/posts
router.post('/:clubId/posts', (req, res) => {
    res.json({ message: `Create club post for club ${req.params.clubId} endpoint not implemented yet` });
});

// POST /api/clubs/:clubId/posts/:postId/like
router.post('/:clubId/posts/:postId/like', (req, res) => {
    res.json({ message: `Like post ${req.params.postId} in club ${req.params.clubId} endpoint not implemented yet` });
});

export default router;