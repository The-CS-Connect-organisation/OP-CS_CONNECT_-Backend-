import { Router } from 'express';
import pkgMulter from 'multer';
const multer = pkgMulter.default || pkgMulter;
import {
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
  createQuestion,
  listQuestions,
  deleteQuestion,
  bulkCreateQuestions,
  startAttempt,
  getAttempt,
  updateAttempt,
  listAttempts,
} from '../controllers/examController.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createExamSchema, createQuestionSchema, bulkQuestionsSchema, startAttemptSchema, updateAttemptSchema } from '../validators/examValidators.js';

const router = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

router.use(requireAuth);

// Exams
router.post('/', allowRoles('admin', 'teacher'), upload.single('paper'), validateRequest(createExamSchema), createExam);
router.get('/', allowRoles('admin', 'teacher', 'student', 'parent'), listExams);
router.get('/:examId', allowRoles('admin', 'teacher', 'student', 'parent'), getExam);
router.patch('/:examId', allowRoles('admin', 'teacher'), updateExam);
router.delete('/:examId', allowRoles('admin'), deleteExam);

// Question Bank
router.post('/questions', allowRoles('admin', 'teacher'), validateRequest(createQuestionSchema), createQuestion);
router.get('/questions', allowRoles('admin', 'teacher', 'student'), listQuestions);
router.delete('/questions/:questionId', allowRoles('admin', 'teacher'), deleteQuestion);
router.post('/questions/bulk', allowRoles('admin', 'teacher'), validateRequest(bulkQuestionsSchema), bulkCreateQuestions);

// Exam Attempts
router.post('/:examId/attempts', allowRoles('student'), validateRequest(startAttemptSchema), startAttempt);
router.get('/attempts/:attemptId', allowRoles('student', 'teacher', 'admin'), getAttempt);
router.patch('/attempts/:attemptId', allowRoles('student'), validateRequest(updateAttemptSchema), updateAttempt);
router.get('/attempts', allowRoles('student', 'teacher', 'admin'), listAttempts);

export default router;
