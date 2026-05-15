import { Router } from 'express';
import {
  createTicket,
  getTickets,
  updateTicket,
  assignTicket,
  resolveTicket,
  getDeviceInventory,
  requestDevice,
} from '../controllers/helpdeskController.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createTicketSchema,
  updateTicketSchema,
  requestDeviceSchema,
} from '../validators/helpdeskValidators.js';

const router = Router();
router.use(requireAuth);

// Create a support ticket
router.post(
  '/',
  validateRequest(createTicketSchema),
  createTicket
);

// Get tickets
router.get('/', getTickets);

// Get device inventory (IT only)
router.get(
  '/devices',
  allowRoles('admin', 'manager'),
  getDeviceInventory
);

// Request a device
router.post(
  '/devices/request',
  requestDevice
);

// Update ticket
router.patch(
  '/:ticketId',
  validateRequest(updateTicketSchema),
  updateTicket
);

// Assign ticket (admin/IT only)
router.post(
  '/:ticketId/assign',
  allowRoles('admin', 'manager'),
  assignTicket
);

// Resolve ticket
router.post(
  '/:ticketId/resolve',
  allowRoles('admin', 'manager'),
  resolveTicket
);

export default router;