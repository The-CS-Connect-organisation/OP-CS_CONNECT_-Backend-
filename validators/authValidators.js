import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .email('Please provide a valid email')
  .max(255);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long');

export const signupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['student', 'teacher', 'admin', 'parent']),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(200),
  }),
});
