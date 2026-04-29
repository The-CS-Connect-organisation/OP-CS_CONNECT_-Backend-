import { z } from 'zod';

// ============================================================================
// ATTENDANCE VALIDATORS
// ============================================================================

export const bulkMarkAttendanceSchema = z.object({
  body: z.object({
    classId: z.string().min(1, 'classId is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    entries: z.array(z.object({
      studentId: z.string().min(1, 'studentId is required'),
      status: z.enum(['present', 'absent', 'late', 'excused'], 'Invalid attendance status'),
      notes: z.string().max(500).optional(),
    })).min(1, 'At least one entry is required'),
  }),
});

// ============================================================================
// GRADING TEMPLATE VALIDATORS
// ============================================================================

export const createGradingTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Template name is required').max(100),
    subject: z.string().max(100).optional(),
    criteria: z.array(z.object({
      name: z.string().min(1),
      maxPoints: z.number().positive(),
      weight: z.number().min(0).max(1).optional(),
    })).min(1, 'At least one criteria is required'),
    rubric: z.record(z.object({
      feedback: z.string(),
      grade: z.string(),
    })).optional(),
    isPublic: z.boolean().optional(),
  }),
});

export const bulkGradeSubmissionsSchema = z.object({
  body: z.object({
    assignmentId: z.string().min(1, 'assignmentId is required'),
    grades: z.array(z.object({
      submissionId: z.string().min(1, 'submissionId is required'),
      marks: z.number().min(0).optional(),
      feedback: z.string().max(2000).optional(),
      criteriaScores: z.record(z.number().min(0)).optional(),
    })).min(1, 'At least one grade entry is required'),
    templateId: z.string().optional(),
    quickFeedback: z.string().max(500).optional(),
  }),
});

// ============================================================================
// CLASS NOTES VALIDATORS
// ============================================================================

export const createClassNoteSchema = z.object({
  body: z.object({
    classId: z.string().min(1, 'classId is required'),
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().max(10000).optional(),
    category: z.enum(['lecture', 'homework', 'resource', 'announcement', 'general']).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    isPinned: z.boolean().optional(),
  }),
});

export const updateClassNoteSchema = z.object({
  params: z.object({
    noteId: z.string().min(1, 'noteId is required'),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(10000).optional(),
    category: z.enum(['lecture', 'homework', 'resource', 'announcement', 'general']).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    isPinned: z.boolean().optional(),
  }),
});

// ============================================================================
// MESSAGE TEMPLATE VALIDATORS
// ============================================================================

export const createMessageTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Template name is required').max(100),
    category: z.enum(['reminder', 'feedback', 'appreciation', 'concern', 'general']).optional(),
    subject: z.string().max(200).optional(),
    body: z.string().min(1, 'Message body is required').max(2000),
    variables: z.array(z.string().regex(/^[a-zA-Z_]+$/, 'Variable name must be alphanumeric with underscores')).optional(),
    isPublic: z.boolean().optional(),
  }),
});

export const sendQuickMessageSchema = z.object({
  body: z.object({
    recipientId: z.string().optional(),
    classId: z.string().optional(),
    templateId: z.string().optional(),
    content: z.string().max(2000).optional(),
    variables: z.record(z.string()).optional(),
  }).refine(data => data.recipientId || data.classId, {
    message: 'Either recipientId or classId is required',
  }),
});

// ============================================================================
// NOTIFICATION VALIDATORS
// ============================================================================

export const createNotificationSchema = z.object({
  body: z.object({
    type: z.enum(['assignment_due', 'low_attendance', 'poor_performance', 'announcement', 'custom']),
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(1000),
    targetUsers: z.array(z.string()).optional(),
    classId: z.string().optional(),
    scheduledAt: z.string().datetime().optional(),
  }),
});

// ============================================================================
// EXPORT VALIDATORS
// ============================================================================

export const exportDataSchema = z.object({
  query: z.object({
    classId: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    subject: z.string().optional(),
    term: z.string().optional(),
    format: z.enum(['csv', 'json']).optional(),
  }),
});

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export default {
  bulkMarkAttendanceSchema,
  createGradingTemplateSchema,
  bulkGradeSubmissionsSchema,
  createClassNoteSchema,
  updateClassNoteSchema,
  createMessageTemplateSchema,
  sendQuickMessageSchema,
  createNotificationSchema,
  exportDataSchema,
};