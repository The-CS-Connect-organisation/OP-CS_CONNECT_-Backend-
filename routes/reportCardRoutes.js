import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createReportCard,
  getReportCard,
  updateReportCard,
  deleteReportCard,
  listReportCards,
  submitReportCard
} from '../controllers/reportCardController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new report card
router.post('/', createReportCard);

// Get a specific report card
router.get('/:id', getReportCard);

// Update a report card
router.put('/:id', updateReportCard);

// Delete a report card
router.delete('/:id', deleteReportCard);

// List report cards with filtering and pagination
router.get('/', listReportCards);

// Submit a report card (mark as Submitted)
router.post('/:id/submit', submitReportCard);

export default router;
