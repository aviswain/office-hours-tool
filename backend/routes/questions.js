import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/supabase.js';

const router = Router();

const QuestionSchema = z.object({
    sessionId: z.string(),
    studentName: z.string().min(1).max(100),
    questionText: z.string().min(1).max(1000)
  });

// POST /api/questions
router.post('/', async (req, res) => {
  const parsed = QuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { sessionId, studentName, questionText } = parsed.data;

  try {
    const result = await pool.query(
      `INSERT INTO questions (session_id, student_name, question_text)
       VALUES ($1, $2, $3) RETURNING id`,
      [sessionId, studentName, questionText]
    );
    res.json({ success: true, questionId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save question' });
  }
});

// GET /api/questions/:sessionId
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, student_name, question_text, cluster_id, is_resolved, upvotes, submitted_at
       FROM questions WHERE session_id = $1 ORDER BY submitted_at ASC`,
      [sessionId]
    );
    res.json({ questions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/questions/:questionId/upvote
router.post('/:questionId/upvote', async (req, res) => {
  const { questionId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE questions SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes`,
      [questionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json({ upvotes: result.rows[0].upvotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

// POST /api/questions/:questionId/downvote
router.post('/:questionId/downvote', async (req, res) => {
  const { questionId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE questions SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1 RETURNING upvotes`,
      [questionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json({ upvotes: result.rows[0].upvotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove upvote' });
  }
});

export default router;