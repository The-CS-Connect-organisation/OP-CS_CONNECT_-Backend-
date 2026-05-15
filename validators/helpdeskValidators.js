import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    category: z.enum(['hardware', 'software', 'network', 'account', 'general']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    deviceId: z.string().optional(),
    screenshots: z.array(z.string().url()).max(5).optional(),
  }),
});

export const updateTicketSchema = z.object({
  body: z.object({
    status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    notes: z.string().max(2000).optional(),
    assignedTo: z.string().optional(),
  }),
});

export const requestDeviceSchema = z.object({
  body: z.object({
    deviceType: z.enum(['laptop', 'tablet', 'desktop', 'printer', 'projector', 'other']).optional(),
    quantity: z.number().min(1).max(100).optional(),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
    requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    classId: z.string().optional(),
  }),
});