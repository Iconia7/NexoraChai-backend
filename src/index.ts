import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import twoFactorRoutes from './routes/twoFactor';
import creatorRoutes from './routes/creator';
import paymentRoutes from './routes/payments';
import withdrawalRoutes from './routes/withdrawalRoutes';

import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Security: Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow images to be loaded cross-origin
}));

// Security: CORS hardening
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://chai.nexoracreatives.co.ke'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Security: Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs for auth
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 payment initializations per hour
  message: { error: 'Payment initialization limit reached. Please try again later.' }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/2fa', authLimiter, twoFactorRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/withdrawals', withdrawalRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Global Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Nexora Chai Backend running on port:${PORT}`);
});
