import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import propertyRoutes from './routes/property.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import agreementRoutes from './routes/agreement.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import verificationRoutes from './routes/verification.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import settingRoutes from './routes/setting.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import cronRoutes from './routes/cron.routes.js';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware for debugging. Credentials and large base64
// document payloads are never written to the logs.
const SENSITIVE_FIELDS = ['password', 'newPassword', 'passwordHash', 'token', 'refreshToken'];
const summariseBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      safe[key] = '[redacted]';
    } else if (typeof value === 'string' && value.length > 256) {
      safe[key] = `[${value.length} chars omitted]`;
    } else {
      safe[key] = value;
    }
  }
  return safe;
};

app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} - Body:`, summariseBody(req.body));
  next();
});

// CORS configuration
const configuredCorsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, '')) // strip trailing slashes
  .filter(Boolean);

const devLocalhostOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

const allowedOrigins = Array.from(new Set([...configuredCorsOrigins, ...devLocalhostOrigins]));
console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      // or matching allowed origins, or any ngrok tunnel domain
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.includes('ngrok')
      ) {
        callback(null, true);
        return;
      }

      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false); // Gracefully reject instead of throwing
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
  })
);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 10000, // limit each IP to 200 requests in production, but allow 10000 in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this device. Please try again in about 15 minutes.'
  }
});
app.use('/api/', limiter);

// Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/cron', cronRoutes);

import { seedDefaults } from './utils/seed-defaults.js';

// Base and Seed routes
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Manual seed trigger — useful for confirming the default admin/setting exist
// after a fresh deploy. The underlying operations are idempotent.
app.get('/api/seed', async (req, res, next) => {
  try {
    await seedDefaults();
    res.status(200).json({ success: true, message: 'Seed complete (idempotent).' });
  } catch (error) {
    next(error);
  }
});

// Unknown routes answer in JSON, then the global error handler formats everything else.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
