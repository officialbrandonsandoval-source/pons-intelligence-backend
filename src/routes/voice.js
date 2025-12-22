import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// POST /api/voice/session/start
router.post('/session/start', async (req, res) => {
	return res.json({
		sessionId: crypto.randomUUID(),
		status: 'ready',
	});
});

export default router;
