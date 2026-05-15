import { Router } from 'express';
import {
  getParentDashboard,
  getParentBookHeavyAlerts,
} from '../controllers/parentController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.use(allowRoles('parent', 'admin'));

// Parent Dashboard
router.get('/dashboard', getParentDashboard);

// Book Heavy Alerts for Parents
router.get('/book-alerts', getParentBookHeavyAlerts);

export default router;