import express from 'express';
import cors from 'cors';
import sessionRoutes from './api/routes/sessions';
import { errorHandler } from './api/middleware/errorHandler';

const app = express();

app.use(cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check — no auth, used by App Runner
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/sessions', sessionRoutes);

// Must be registered last
app.use(errorHandler);

export default app;
