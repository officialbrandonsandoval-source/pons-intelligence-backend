const { logError } = require('../utils/logger');

const authenticate = (req, res, next) => {
	const providedKey = req.headers['x-api-key'];
	const expectedKey = process.env.API_KEY;

	if (!expectedKey) {
		logError(new Error('API_KEY not set'));
		return res.status(500).json({ error: 'Server auth is not configured' });
	}

	if (!providedKey || providedKey !== expectedKey) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	return next();
};

module.exports = { authenticate };
