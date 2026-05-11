import { Router } from 'express';
import pool from '../db/supabase.js';
import { clusterQuestions, generateSummary } from '../services/claude.js';

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

// GET /api/sessions/:sessionId/summary
router.get('/:sessionId/summary', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const clustersResult = await pool.query(
      `SELECT id, label, answer FROM clusters
       WHERE session_id = $1 AND is_resolved = true ORDER BY resolved_at ASC`,
      [sessionId]
    );

    const clusters = await Promise.all(clustersResult.rows.map(async (cluster) => {
      const questionsResult = await pool.query(
        `SELECT student_name, question_text FROM questions WHERE cluster_id = $1`,
        [cluster.id]
      );
      return { ...cluster, questions: questionsResult.rows };
    }));

    const markdown = await generateSummary(clusters);
    res.json({ markdown });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: 'Failed to generate summary', message: err.message });
  }
});

export default router;
