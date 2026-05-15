import { Router } from 'express';
import {
  submitHealthRecord,
  getHealthRecords,
  sendClinicAlert,
  getClinicAlerts,
  getDashboard,
} from '../controllers/clinicController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  submitHealthRecordSchema,
  sendClinicAlertSchema,
} from '../validators/clinicValidators.js';

const router = Router();
router.use(requireAuth);

// Submit a health record for a student
router.post(
  '/records',
  validateRequest(submitHealthRecordSchema),
  submitHealthRecord
);

// Get health records for a student
router.get(
  '/records/:studentId',
  allowRoles('teacher', 'admin', 'parent', 'manager'),
  getHealthRecords
);

// Send a clinic alert
router.post(
  '/alerts',
  validateRequest(sendClinicAlertSchema),
  sendClinicAlert
);

// Get clinic alerts
router.get(
  '/alerts',
  allowRoles('teacher', 'admin', 'parent', 'manager'),
  getClinicAlerts
);

// Health dashboard
router.get('/dashboard', allowRoles('teacher', 'admin', 'manager'), getDashboard);

export default router;