import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import feesRoutes from './routes/feesRoutes.js';
import busRoutes from './routes/busRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import studentAssistantRoutes from './routes/studentAssistantRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import reportCardRoutes from './routes/reportCardRoutes.js';
import examRoutes from './routes/examRoutes.js';
import aiAnalysisRoutes from './routes/aiAnalysisRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import userPrefsRoutes from './routes/userPrefsRoutes.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { setIO, getIO } from './utils/socket.js';
import { sanitizeInput } from './middleware/sanitizer.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { requireAuth, allowRoles } from './middleware/auth.js';

const app = express();

// Trust Render's proxy so rate-limiter and IP detection work correctly
app.set('trust proxy', 1);

export const setSocketServer = (io) => {
  setIO(io);
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      const allowed = [
        env.CORS_ORIGIN,
        // Always allow both deployed frontends
        'https://the-cs-connect-organisation.github.io',
        // Allow local dev servers to connect to the remote API
        'http://localhost:5173',
        'http://localhost:3000'
      ].filter(Boolean);
      // In development, allow any localhost port
      if (env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      if (allowed.some(o => origin === o || origin.startsWith(o))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.get('/api/debug-errors', requireAuth, allowRoles('admin'), async (req, res) => {
  try {
    const { db } = await import('./config/firebase.js');
    const snap = await db.ref('error_logs').limitToLast(5).once('value');
    res.json(snap.val());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.json({ limit: '200kb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Security and sanitization middleware
app.use(sanitizeInput);

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use((_req, _res, next) => {
  _req.io = getIO();
  next();
});

// Rate limiting
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'CS Connect API is running' });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/bus', busRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student-assistant', studentAssistantRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/report-cards', reportCardRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/ai-analysis', aiAnalysisRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/user-prefs', userPrefsRoutes);

// Mirror all routes without /api prefix so both /api/auth/login and /auth/login work
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/school', schoolRoutes);
app.use('/chat', chatRoutes);
app.use('/gamification', gamificationRoutes);
app.use('/fees', feesRoutes);
app.use('/bus', busRoutes);
app.use('/teacher', teacherRoutes);
app.use('/student-assistant', studentAssistantRoutes);
app.use('/student', studentRoutes);
app.use('/report-cards', reportCardRoutes);
app.use('/exams', examRoutes);
app.use('/ai-analysis', aiAnalysisRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/friends', friendRoutes);
app.use('/user-prefs', userPrefsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
