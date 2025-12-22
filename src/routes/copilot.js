import express from 'express';

const router = express.Router();

// POST /api/copilot
router.post('/', async (req, res) => {
	const { query } = req.body || {};
	return res.json({
		response: `Received: ${query}`,
	});
});

export default router;
