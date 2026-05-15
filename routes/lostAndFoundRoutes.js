import { Router } from 'express';
import {
  createLostItem,
  getLostItems,
  claimLostItem,
  deleteLostItem,
  getMyLostItems,
} from '../controllers/lostAndFoundController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createLostItemSchema,
  claimLostItemSchema,
} from '../validators/lostAndFoundValidators.js';

const router = Router();
router.use(requireAuth);

// Create a lost/found item
router.post(
  '/',
  validateRequest(createLostItemSchema),
  createLostItem
);

// Get all lost & found items (filterable)
router.get('/', allowRoles('student', 'teacher', 'admin', 'parent', 'manager'), getLostItems);

// Get my items (reported by me)
router.get('/my', getMyLostItems);

// Claim a found item (students/parents claim, teachers/admin verify)
router.post(
  '/:itemId/claim',
  validateRequest(claimLostItemSchema),
  claimLostItem
);

// Delete (only admin/manager or original reporter)
router.delete('/:itemId', deleteLostItem);

export default router;