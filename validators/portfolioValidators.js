import { z } from 'zod';

export const createPortfolioSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    academicYear: z.string().optional(),
    grade: z.string().optional(),
    section: z.string().optional(),
  }),
});

export const updatePortfolioSchema = z.object({
  body: z.object({
    skills: z.array(z.string()).max(50).optional(),
    objectives: z.array(z.string()).max(50).optional(),
    academicYear: z.string().optional(),
  }),
});