import { Router } from 'express';

const router = Router();

// GET /api/timetable/:className
router.get('/:className', (req, res) => {
    res.json({ message: `Get timetable for ${req.params.className} endpoint not implemented yet` });
});

// POST /api/timetable
router.post('/', (req, res) => {
    res.json({ message: 'Update timetable endpoint not implemented yet' });
});

// DELETE /api/timetable/:id
router.delete('/:id', (req, res) => {
    res.json({ message: `Delete timetable entry ${req.params.id} endpoint not implemented yet` });
});

export default router;