import express from 'express';
import { generateExplaination } from '../services/aiService.js';

const router = express.Router();

router.post('/explain', async (req, res) => {
  try {
    console.log('[AI] req.headers.content-type:', req.headers['content-type']);
    console.log('[AI] req.body:', req.body);
    console.log('[AI] site keys:', Object.keys(req.body || {}));

    const site = req.body;
    const explaination = await generateExplaination(site);

    res.json({ explaination });
  } catch (error) {
    console.error('[AI] Error generating AI explaination:', error?.message);
    console.error(error);
    res.status(500).json({ error: 'Failed to generate explaination', message: error?.message });
  }
});

export default router;
