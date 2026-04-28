import { Router } from 'express';
import {
  createBus,
  listBuses,
  getBus,
  updateBus,
  deleteBus,
  createRoute,
  listRoutes,
  getRoute,
  updateRoute,
  deleteRoute,
  updateBusLocation,
  getBusLocationHistory,
  getActiveBusesOnRoute,
} from '../controllers/busController.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// ── Bus Routes ──
router.post('/buses', allowRoles('admin'), createBus);
router.get('/buses', allowRoles('admin', 'teacher', 'student', 'parent'), listBuses);
router.get('/buses/:busId', allowRoles('admin', 'teacher', 'student', 'parent'), getBus);
router.patch('/buses/:busId', allowRoles('admin'), updateBus);
router.delete('/buses/:busId', allowRoles('admin'), deleteBus);

// ── Route Management ──
router.post('/routes', allowRoles('admin'), createRoute);
router.get('/routes', allowRoles('admin', 'teacher', 'student', 'parent'), listRoutes);
router.get('/routes/:routeId', allowRoles('admin', 'teacher', 'student', 'parent'), getRoute);
router.patch('/routes/:routeId', allowRoles('admin'), updateRoute);
router.delete('/routes/:routeId', allowRoles('admin'), deleteRoute);

// ── Bus Location Tracking ──
router.patch('/buses/:busId/location', allowRoles('admin', 'driver'), updateBusLocation);
router.get('/buses/:busId/location-history', allowRoles('admin', 'teacher', 'student', 'parent'), getBusLocationHistory);
router.get('/routes/:routeId/active-buses', allowRoles('admin', 'teacher', 'student', 'parent'), getActiveBusesOnRoute);

export default router;
