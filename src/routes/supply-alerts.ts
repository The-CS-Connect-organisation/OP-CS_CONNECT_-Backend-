import { Router } from 'express';

const router = Router();

// GET /api/supply-alerts
router.get('/', (req, res) => {
    res.json({ message: 'Get supply alerts endpoint not implemented yet' });
});

// POST /api/supply-alerts
router.post('/', (req, res) => {
    res.json({ message: 'Create supply alert endpoint not implemented yet' });
});

// PUT /api/supply-alerts/:id
router.put('/:id', (req, res) => {
    res.json({ message: `Update supply alert ${req.params.id} endpoint not implemented yet` });
});

export default router;