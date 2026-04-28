import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import feesRoutes from './routes/feesRoutes.js';
import busRoutes from './routes/busRoutes.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
let ioInstance = null;

export const setSocketServer = (io) => {
  ioInstance = io;
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
app.use(express.json({ limit: '200kb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use((req, _res, next) => {
  req.io = ioInstance;
  next();
});
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'CS Connect API is running' });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/bus', busRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
