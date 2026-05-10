import { Router } from 'express';

const router = Router();

// POST /api/sessions/:sessionId/cluster
// TODO: Partner implements this — calls Claude API to cluster questions
router.post('/:sessionId/cluster', async (req, res) => {
  res.json({ success: true, message: 'clustering stub — partner implements this' });
});

export default router;