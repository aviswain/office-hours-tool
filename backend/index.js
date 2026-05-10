import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Only allow requests from your frontend URL
// FRONTEND_URL must not have a trailing slash — see Step 8
app.use(cors({
  origin: process.env.FRONTEND_URL
}));

// Rate limit all /api routes: max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check — this is the URL you hit to confirm deployment worked
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Stub Routes (real logic added in Phase 2) ---

app.post('/api/questions', (req, res) => {
  res.json({ success: true, message: 'stub — question received' });
});

app.get('/api/clusters/:sessionId', (req, res) => {
  res.json({ clusters: [] });
});

app.post('/api/clusters/:clusterId/resolve', (req, res) => {
  res.json({ success: true, message: 'stub — cluster resolved' });
});

// ---

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});