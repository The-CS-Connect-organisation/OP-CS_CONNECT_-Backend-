import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  triggerAnalysis,
  getAnalysis,
  analyzeTrendAnalysis,
  getClassAverage,
  compareStudentWithClass,
  getPercentileRank
} from '../controllers/aiAnalysisController.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Trigger AI analysis for a report card
router.post('/analyze', triggerAnalysis);

// Get stored AI analysis for a report card
router.get('/:reportCardId', getAnalysis);

// Analyze trends across multiple terms
router.post('/trends/analyze', analyzeTrendAnalysis);

// Get class average for a term
router.get('/class-average', getClassAverage);

// Compare student with class average
router.get('/comparison/student', compareStudentWithClass);

// Get percentile rank
router.get('/percentile/rank', getPercentileRank);

export default router;
