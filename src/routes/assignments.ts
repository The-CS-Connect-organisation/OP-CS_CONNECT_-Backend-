import { Router } from 'express';

const router = Router();

// GET /api/assignments
router.get('/', (req, res) => {
    res.json({ message: 'Get assignments endpoint not implemented yet' });
});

// GET /api/assignments/:id
router.get('/:id', (req, res) => {
    res.json({ message: `Get assignment ${req.params.id} endpoint not implemented yet` });
});

// POST /api/assignments
router.post('/', (req, res) => {
    res.json({ message: 'Create assignment endpoint not implemented yet' });
});

// PUT /api/assignments/:id
router.put('/:id', (req, res) => {
    res.json({ message: `Update assignment ${req.params.id} endpoint not implemented yet` });
});

// DELETE /api/assignments/:id
router.delete('/:id', (req, res) => {
    res.json({ message: `Delete assignment ${req.params.id} endpoint not implemented yet` });
});

// POST /api/assignments/:id/submit
router.post('/:id/submit', (req, res) => {
    res.json({ message: `Submit assignment ${req.params.id} endpoint not implemented yet` });
});

// POST /api/assignments/:id/grade
router.post('/:id/grade', (req, res) => {
    res.json({ message: `Grade assignment ${req.params.id} endpoint not implemented yet` });
});

// POST /api/assignments/:id/publish
router.post('/:id/publish', (req, res) => {
    res.json({ message: `Publish assignment ${req.params.id} endpoint not implemented yet` });
});

export default router;