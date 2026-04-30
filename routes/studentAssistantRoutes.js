import { Router } from 'express';
import {
  // Doubt Resolution
  resolveDoubt,
  getDoubtHistory,
  // Study Plan
  generateStudyPlan,
  getStudyPlan,
  updateStudyPlanProgress,
  // Flashcards
  generateFlashcards,
  getFlashcards,
  reviewFlashcard,
  // Practice Tests
  generatePracticeTest,
  submitPracticeTest,
  getPracticeTests,
  // Analytics
  getStudyAnalytics,
  // Answer Scoring
  scoreAnswer,
  getAnswerAnalysisHistory,
} from '../controllers/studentAssistantController.js';
import { allowRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  resolveDoubtSchema,
  generateStudyPlanSchema,
  updateStudyPlanProgressSchema,
  generateFlashcardsSchema,
  reviewFlashcardSchema,
  generatePracticeTestSchema,
  submitPracticeTestSchema,
  scoreAnswerSchema,
} from '../validators/studentAssistantValidators.js';

const router = Router();

// Apply authentication to all student assistant routes - only students can access
router.use(allowRoles('student'));

// ============================================================================
// AI DOUBT RESOLUTION
// ============================================================================
router.post('/doubts/resolve', validateRequest(resolveDoubtSchema), resolveDoubt);
router.get('/doubts/history', getDoubtHistory);

// ============================================================================
// STUDY PLAN GENERATOR
// ============================================================================
router.post('/study-plan/generate', validateRequest(generateStudyPlanSchema), generateStudyPlan);
router.get('/study-plan/:planId', getStudyPlan);
router.patch('/study-plan/:planId/progress', validateRequest(updateStudyPlanProgressSchema), updateStudyPlanProgress);

// ============================================================================
// FLASHCARD GENERATOR
// ============================================================================
router.post('/flashcards/generate', validateRequest(generateFlashcardsSchema), generateFlashcards);
router.get('/flashcards', getFlashcards);
router.post('/flashcards/review', validateRequest(reviewFlashcardSchema), reviewFlashcard);

// ============================================================================
// PRACTICE TEST GENERATOR
// ============================================================================
router.post('/practice-tests/generate', validateRequest(generatePracticeTestSchema), generatePracticeTest);
router.post('/practice-tests/:testId/submit', validateRequest(submitPracticeTestSchema), submitPracticeTest);
router.get('/practice-tests', getPracticeTests);

// ============================================================================
// STUDY ANALYTICS
// ============================================================================
router.get('/analytics', getStudyAnalytics);

// ============================================================================
// AI ANSWER SCORER
// ============================================================================
router.post('/score-answer', validateRequest(scoreAnswerSchema), scoreAnswer);
router.get('/answer-history', getAnswerAnalysisHistory);

export default router;
