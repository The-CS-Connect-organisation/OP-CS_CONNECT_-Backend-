import { z } from 'zod';

export const submitHealthRecordSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    recordType: z.enum(['visit', 'medication', 'injury', 'allergy_update', 'immunization', 'checkup']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    symptoms: z.array(z.string().max(200)).max(20).optional(),
    diagnosis: z.string().max(2000).optional(),
    treatment: z.string().max(2000).optional(),
    medication: z.string().max(500).optional(),
    doctor: z.string().max(200).optional(),
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    isEmergency: z.boolean().optional().default(false),
    notes: z.string().max(5000).optional(),
  }),
});

export const sendClinicAlertSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(5000),
    severity: z.enum(['info', 'warning', 'critical', 'emergency']).optional(),
    targetGroups: z.array(z.enum(['all', 'students', 'teachers', 'parents', 'specific_class'])).min(1, 'At least one target group'),
    classId: z.string().optional(),
    requiresAction: z.boolean().optional().default(false),
    actionDescription: z.string().max(1000).optional(),
  }),
});