import { Router } from 'express';

const router = Router();

// GET /api/calendar
router.get('/', (req, res) => {
    res.json({ message: 'Get calendar events endpoint not implemented yet' });
});

// POST /api/calendar
router.post('/', (req, res) => {
    res.json({ message: 'Create calendar event endpoint not implemented yet' });
});

// DELETE /api/calendar/:id
router.delete('/:id', (req, res) => {
    res.json({ message: `Delete calendar event ${req.params.id} endpoint not implemented yet` });
});

export default router;