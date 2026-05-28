import { Router } from 'express';

const router = Router();

// POST /api/grades/enter
router.post('/enter', (req, res) => {
    res.json({ message: 'Enter grades endpoint not implemented yet' });
});

export default router;