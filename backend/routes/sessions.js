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
// TODO: Partner implements this — calls Claude API to cluster questions
router.post('/:sessionId/cluster', async (req, res) => {
  res.json({ success: true, message: 'clustering stub — partner implements this' });
});

export default router;