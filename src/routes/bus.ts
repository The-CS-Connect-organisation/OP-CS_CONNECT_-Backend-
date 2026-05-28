import { Router } from 'express';

const router = Router();

// GET /api/bus/routes
router.get('/routes', (req, res) => {
    res.json({ message: 'Get bus routes endpoint not implemented yet' });
});

// GET /api/bus/location/:routeId
router.get('/location/:routeId', (req, res) => {
    res.json({ message: `Get bus location for route ${req.params.routeId} endpoint not implemented yet` });
});

export default router;