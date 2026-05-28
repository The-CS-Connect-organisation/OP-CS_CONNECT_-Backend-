import { Router } from 'express';

const router = Router();

// GET /api/notes
router.get('/', (req, res) => {
    res.json({ message: 'Get notes endpoint not implemented yet' });
});

// POST /api/notes
router.post('/', (req, res) => {
    res.json({ message: 'Create note endpoint not implemented yet' });
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
    res.json({ message: `Update note ${req.params.id} endpoint not implemented yet` });
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
    res.json({ message: `Delete note ${req.params.id} endpoint not implemented yet` });
});

// GET /api/notes/shared
router.get('/shared', (req, res) => {
    res.json({ message: 'Get shared notes endpoint not implemented yet' });
});

// POST /api/notes/shared/:id/like
router.post('/shared/:id/like', (req, res) => {
    res.json({ message: `Like shared note ${req.params.id} endpoint not implemented yet` });
});

// POST /api/notes/:id/share
router.post('/:id/share', (req, res) => {
    res.json({ message: `Share note ${req.params.id} endpoint not implemented yet` });
});

export default router;