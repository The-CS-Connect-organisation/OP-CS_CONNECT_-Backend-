import { Router } from 'express';

const router = Router();

// POST /api/study-plan
router.post('/', (req, res) => {
    res.json({ message: 'Create study task endpoint not implemented yet' });
});

// PUT /api/study-plan/:id
router.put('/:id', (req, res) => {
    res.json({ message: `Update study task ${req.params.id} endpoint not implemented yet` });
});

// DELETE /api/study-plan/:id
router.delete('/:id', (req, res) => {
    res.json({ message: `Delete study task ${req.params.id} endpoint not implemented yet` });
});

export default router;