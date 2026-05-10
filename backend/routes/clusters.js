import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/supabase.js';

const router = Router();

const ResolveSchema = z.object({
  answer: z.string().min(1).max(5000)
});

// GET /api/clusters/:sessionId — TA dashboard polls this
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    // Get all clusters with their questions
    const clustersResult = await pool.query(
      `SELECT id, label, answer, is_resolved, resolved_at, created_at
       FROM clusters WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    const clusters = await Promise.all(clustersResult.rows.map(async (cluster) => {
      const questionsResult = await pool.query(
        `SELECT id, student_name, question_text, submitted_at
         FROM questions WHERE cluster_id = $1`,
        [cluster.id]
      );
      return {
        ...cluster,
        questions: questionsResult.rows,
        questionCount: questionsResult.rows.length
      };
    }));

    // Also get questions not yet clustered
    const unclusteredResult = await pool.query(
      `SELECT id, student_name, question_text, submitted_at
       FROM questions WHERE session_id = $1 AND cluster_id IS NULL AND is_resolved = false`,
      [sessionId]
    );

    res.json({ clusters, unclustered: unclusteredResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// POST /api/clusters/:clusterId/resolve — TA resolves a cluster
router.post('/:clusterId/resolve', async (req, res) => {
  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { clusterId } = req.params;
  const { answer } = parsed.data;

  try {
    // Mark cluster resolved with answer
    await pool.query(
      `UPDATE clusters SET is_resolved = true, answer = $1, resolved_at = now()
       WHERE id = $2`,
      [answer, clusterId]
    );
    // Mark all questions in cluster as resolved
    await pool.query(
      `UPDATE questions SET is_resolved = true WHERE cluster_id = $1`,
      [clusterId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve cluster' });
  }
});

export default router;