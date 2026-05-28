import { Router } from 'express';

const router = Router();

// GET /api/schools
router.get('/', (req, res) => {
    res.json({ message: 'Get schools endpoint not implemented yet' });
});

export default router;