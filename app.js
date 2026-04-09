import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
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
      if (!origin) return callback(null, true);
      if (origin === env.CORS_ORIGIN) return callback(null, true);
      if (env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
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

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
