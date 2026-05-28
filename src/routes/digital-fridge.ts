import { Router } from 'express';

const router = Router();

// GET /api/digital-fridge/:childId
router.get('/:childId', (req, res) => {
    res.json({ message: `Get digital fridge for child ${req.params.childId} endpoint not implemented yet` });
});

// POST /api/digital-fridge
router.post('/', (req, res) => {
    res.json({ message: 'Create digital fridge item endpoint not implemented yet' });
});

export default router;