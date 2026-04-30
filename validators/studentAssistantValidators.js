import { z } from 'zod';

// ============================================================================
// DOUBT RESOLUTION VALIDATORS
// ============================================================================

export const resolveDoubtSchema = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required').max(2000).optional(),
    subject: z.string().max(100).optional(),
    context: z.string().max(1000).optional(),
    imageUrl: z.string().url().optional(),
  }).refine(data => data.question || data.imageUrl, {
    message: 'Either question text or image URL is required',
  }),
});

// ============================================================================
// STUDY PLAN VALIDATORS
// ============================================================================

export const generateStudyPlanSchema = z.object({
  body: z.object({
    days: z.number().min(1).max(90).default(7),
    focusAreas: z.array(z.string()).max(10).optional(),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export const updateStudyPlanProgressSchema = z.object({
  params: z.object({
    planId: z.string().min(1, 'planId is required'),
  }),
  body: z.object({
    taskId: z.string().min(1, 'taskId is required'),
    completed: z.boolean(),
  }),
});

// ============================================================================
// FLASHCARD VALIDATORS
// ============================================================================

export const generateFlashcardsSchema = z.object({
  body: z.object({
    text: z.string().min(50, 'Text must be at least 50 characters').max(10000),
    subject: z.string().max(100),
    topic: z.string().max(200),
  }),
});

export const reviewFlashcardSchema = z.object({
  body: z.object({
    setId: z.string().min(1, 'Set ID is required'),
    cardId: z.string().min(1, 'Card ID is required'),
    rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
  }),
});

// ============================================================================
// PRACTICE TEST VALIDATORS
// ============================================================================

export const generatePracticeTestSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required').max(100),
    topic: z.string().min(1, 'Topic is required').max(200),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    questionCount: z.number().min(1).max(50).default(10),
    timeLimit: z.number().min(5).max(180).optional(), // minutes
  }),
});

export const submitPracticeTestSchema = z.object({
  params: z.object({
    testId: z.string().min(1, 'testId is required'),
  }),
  body: z.object({
    answers: z.array(z.string()).min(1, 'At least one answer is required'),
  }),
});

// ============================================================================
// ANSWER SCORER VALIDATORS
// ============================================================================

export const scoreAnswerSchema = z.object({
  body: z.object({
    text: z.string().min(10, 'Text must be at least 10 characters').max(10000).optional(),
    subject: z.string().max(100).default('english'),
    questionPrompt: z.string().max(500).optional(),
    maxScore: z.number().min(1).max(100).default(10),
    imageUrl: z.string().url().optional(),
  }).refine(data => data.text || data.imageUrl, {
    message: 'Either text content or image URL is required',
  }),
});

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export default {
  resolveDoubtSchema,
  generateStudyPlanSchema,
  updateStudyPlanProgressSchema,
  generateFlashcardsSchema,
  reviewFlashcardSchema,
  generatePracticeTestSchema,
  submitPracticeTestSchema,
  scoreAnswerSchema,
};
