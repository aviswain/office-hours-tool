import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import questionsRouter from './routes/questions.js';
import clustersRouter from './routes/clusters.js';
import sessionsRouter from './routes/sessions.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/questions', questionsRouter);
app.use('/api/clusters', clustersRouter);
app.use('/api/sessions', sessionsRouter);  // partner fills this in

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));