import { z } from 'zod';

export const createLostItemSchema = z.object({
  body: z.object({
    type: z.enum(['lost', 'found'], 'Invalid type'),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(5000),
    category: z.enum(['personal', 'electronic', 'clothing', 'book', 'bag', 'jewelry', 'other']).optional(),
    location: z.string().min(1, 'Location is required').max(500),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    imageUrl: z.string().url().optional().or(z.literal('')),
    contactInfo: z.string().max(500).optional(),
    isAnonymous: z.boolean().optional(),
  }),
});

export const claimLostItemSchema = z.object({
  body: z.object({
    claimantName: z.string().min(1, 'Name is required').max(100),
    claimantEmail: z.string().email('Invalid email').optional(),
    description: z.string().max(500).optional(),
    proofDescription: z.string().max(1000).optional(),
  }),
});