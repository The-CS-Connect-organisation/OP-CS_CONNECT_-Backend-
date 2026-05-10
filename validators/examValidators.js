import { body, param, query } from 'express-validator';

export const createExamSchema = [
  body('name').trim().notEmpty().withMessage('Exam name is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('classId').optional().trim(),
  body('class_id').optional().trim(),
  body('date').optional().isISO8601().withMessage('Valid date required'),
  body('maxMarks').optional().isInt({ min: 1 }).withMessage('maxMarks must be a positive integer'),
  body('max_marks').optional().isInt({ min: 1 }).withMessage('max_marks must be a positive integer'),
];

export const createQuestionSchema = [
  body('text').trim().notEmpty().withMessage('Question text is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('options').optional().isArray({ min: 2 }).withMessage('options must be an array with at least 2 items'),
  body('correctIndex').optional().isInt({ min: 0 }).withMessage('correctIndex must be a non-negative integer'),
  body('correct_index').optional().isInt({ min: 0 }).withMessage('correct_index must be a non-negative integer'),
  body('marks').optional().isInt({ min: 1 }).withMessage('marks must be a positive integer'),
  body('classId').optional().trim(),
  body('class_id').optional().trim(),
];

export const bulkQuestionsSchema = [
  body('questions').isArray({ min: 1 }).withMessage('questions array is required'),
];

export const startAttemptSchema = [
  body('examId').optional().trim(),
  body('answers').optional().isObject().withMessage('answers must be an object'),
  body('questionIds').optional().isArray().withMessage('questionIds must be an array'),
  body('maxScore').optional().isInt({ min: 0 }).withMessage('maxScore must be a non-negative integer'),
];

export const updateAttemptSchema = [
  body('answers').optional().isObject().withMessage('answers must be an object'),
  body('finished').optional().isBoolean().withMessage('finished must be a boolean'),
  body('score').optional().isInt({ min: 0 }).withMessage('score must be a non-negative integer'),
];
