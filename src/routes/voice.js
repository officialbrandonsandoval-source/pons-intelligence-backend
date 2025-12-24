const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// POST /api/voice/session/start
// No auth yet.
// No OpenAI calls yet.
// Must return JSON only.
router.post('/session/start', (req, res) => {
	return res.json({
		sessionId: crypto.randomUUID(),
		status: 'ready',
	});
});

module.exports = router;
