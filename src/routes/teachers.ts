import { Router } from 'express';

const router = Router();

// GET /api/teachers
router.get('/', (req, res) => {
    res.json({ message: 'Get teachers endpoint not implemented yet' });
});

// GET /api/teachers/:id
router.get('/:id', (req, res) => {
    res.json({ message: `Get teacher ${req.params.id} endpoint not implemented yet` });
});

// GET /api/teachers/:id/classes
router.get('/:id/classes', (req, res) => {
    res.json({ message: `Get teacher classes for ${req.params.id} endpoint not implemented yet` });
});

export default router;