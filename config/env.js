
import dotenv from 'dotenv';
import { z } from 'zod';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

// Strip whitespace from all environment variables to handle Render's newline injection
const cleanEnv = Object.entries(process.env).reduce((acc, [key, value]) => {
  acc[key] = typeof value === 'string' ? value.trim() : value;
  return acc;
}, {});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email('FIREBASE_CLIENT_EMAIL must be a valid email'),
  FIREBASE_DATABASE_URL: z.string().url('FIREBASE_DATABASE_URL must be a valid URL'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CEREBRAS_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  STREAM_API_KEY: z.string().default('n9v8bfwy45pn'),
  STREAM_API_SECRET: z.string().default(''),
});

const parsed = envSchema.safeParse(cleanEnv);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsed.data;
