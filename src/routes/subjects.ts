import { Router } from 'express';

const router = Router();

// GET /api/subjects
router.get('/', (req, res) => {
    res.json({ message: 'Get subjects endpoint not implemented yet' });
});

// GET /api/subjects/:id
router.get('/:id', (req, res) => {
    res.json({ message: `Get subject ${req.params.id} endpoint not implemented yet` });
});

export default router;