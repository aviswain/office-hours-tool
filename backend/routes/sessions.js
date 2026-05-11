import { Router } from 'express';
import pool from '../db/supabase.js';

const router = Router();

// Reset Button for Demo Purposes (has nothing to do with AI clustering functionality)
router.post('/:sessionId/reset', async (req, res) => {
    const { sessionId } = req.params;
    try {
      await pool.query(`UPDATE questions SET cluster_id = NULL WHERE session_id = $1`, [sessionId]);
      await pool.query(`DELETE FROM clusters WHERE session_id = $1`, [sessionId]);
      await pool.query(`DELETE FROM questions WHERE session_id = $1`, [sessionId]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Reset failed' });
    }
});
  
// POST /api/sessions/:sessionId/cluster
router.post('/:sessionId/cluster', async (req, res) => {
  const { sessionId } = req.params;

  try {
    // 1. Fetch all unresolved questions for this session
    const result = await pool.query(
      `SELECT id, question_text FROM questions
       WHERE session_id = $1 AND is_resolved = false`,
      [sessionId]
    );

    const questions = result.rows;
    if (questions.length === 0) {
      return res.json({ success: true, message: 'No questions to cluster', clustersCreated: 0 });
    }

    // 2. Call Claude — validates output and strips hallucinated IDs
    const clusters = await clusterQuestions(questions);

    // 3. Clear existing unresolved clusters (re-clustering replaces them)
    await pool.query(
      `UPDATE questions SET cluster_id = NULL WHERE session_id = $1 AND is_resolved = false`,
      [sessionId]
    );
    await pool.query(
      `DELETE FROM clusters WHERE session_id = $1 AND is_resolved = false`,
      [sessionId]
    );

    // 4. Write new clusters and assign question IDs
    for (const cluster of clusters) {
      const clusterResult = await pool.query(
        `INSERT INTO clusters (session_id, label) VALUES ($1, $2) RETURNING id`,
        [sessionId, cluster.label]
      );
      const clusterId = clusterResult.rows[0].id;

      for (const questionId of cluster.questionIds) {
        await pool.query(
          `UPDATE questions SET cluster_id = $1 WHERE id = $2`,
          [clusterId, questionId]
        );
      }
    }

    res.json({ success: true, clustersCreated: clusters.length });
  } catch (err) {
    console.error('Clustering error:', err.message);
    res.status(500).json({
      error: 'Clustering failed',
      message: err.message,
      retryable: true
    });
  }
});

export default router;
