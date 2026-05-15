import { z } from 'zod';

export const createReportSchema = z.object({
  body: z.object({
    type: z.enum(['bullying', 'theft', 'vandalism', 'safety', 'academic_misconduct', 'harassment', 'other']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    location: z.string().max(500).optional(),
    dateOfIncident: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    isAnonymous: z.boolean().optional().default(false),
    evidenceUrls: z.array(z.string().url()).max(10).optional(),
  }),
});

export const updateReportStatusSchema = z.object({
  body: z.object({
    status: z.enum(['under_review', 'investigating', 'resolved', 'dismissed']).optional(),
    notes: z.string().max(2000).optional(),
  }),
});