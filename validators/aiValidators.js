import { z } from 'zod';

const optionalModel = z.string().trim().min(1).optional();

export const doubtSolverSchema = z.object({
  body: z.object({
    question: z.string().trim().min(5).max(4000),
    subject: z.string().trim().min(2).max(80),
    model: optionalModel,
    stream: z.boolean().optional(),
  }),
});

export const studyPlannerSchema = z.object({
  body: z.object({
    exams: z
      .array(
        z.object({
          subject: z.string().trim().min(2).max(80),
          date: z.string().trim().min(4).max(80),
          topics: z.array(z.string().trim().min(1).max(120)).min(1),
        })
      )
      .min(1),
    hoursPerDay: z.number().min(1).max(16),
    model: optionalModel,
  }),
});

export const gradePredictorSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(2).max(80),
    marks: z.array(z.number().min(0).max(100)).min(2),
    examType: z.string().trim().min(2).max(50),
    model: optionalModel,
  }),
});

export const assignmentFeedbackSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(2).max(80),
    rubric: z.string().trim().min(5).max(2000).optional(),
    essay: z.string().trim().min(30).max(15000),
    model: optionalModel,
  }),
});

export const quizGeneratorSchema = z.object({
  body: z.object({
    topic: z.string().trim().min(2).max(150),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    questionCount: z.number().int().min(1).max(20).default(10),
    model: optionalModel,
  }),
});

export const attendanceInsightsSchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          date: z.string(),
          status: z.enum(['present', 'absent', 'late']),
        })
      )
      .min(5),
    model: optionalModel,
  }),
});
