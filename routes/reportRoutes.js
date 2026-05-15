import { Router } from 'express';
import {
  createReport,
  getReports,
  updateReportStatus,
  getReportById,
} from '../controllers/reportController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createReportSchema,
  updateReportStatusSchema,
} from '../validators/reportValidators.js';

const router = Router();
router.use(requireAuth);

// Submit anonymous or named report
router.post(
  '/',
  validateRequest(createReportSchema),
  createReport
);

// Get all reports (students see only their own, admins/teachers see all)
router.get('/', getReports);

// Get a single report by ID
router.get('/:reportId', getReportById);

// Update report status (admin/teacher only)
router.patch(
  '/:reportId/status',
  allowRoles('teacher', 'admin', 'manager'),
  validateRequest(updateReportStatusSchema),
  updateReportStatus
);

export default router;