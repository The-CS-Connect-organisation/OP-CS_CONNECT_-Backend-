import { Router } from 'express';

const router = Router();

// GET /api/payroll/teacher/:teacherId
router.get('/teacher/:teacherId', (req, res) => {
    res.json({ message: `Get payroll for teacher ${req.params.teacherId} endpoint not implemented yet` });
});

export default router;