const { logError } = require('../utils/logger');

const isAllowlistedRoute = (req) => {
	const method = String(req.method || '').toUpperCase();
	// Prefer originalUrl so mounted routers (/api) are accounted for.
	// Strip query string to keep checks deterministic.
	const rawPath = String(req.originalUrl || req.url || '');
	const path = rawPath.split('?')[0];

	// Explicit demo allowlist (no env flags).
	if (method === 'GET' && path === '/api/health') return true;
	if (method === 'POST' && path === '/api/copilot') return true;

	return false;
};

const authenticate = (req, res, next) => {
	if (isAllowlistedRoute(req)) return next();

	const providedKey = req.headers['x-api-key'];
	const expectedKey = process.env.API_KEY;

	if (!expectedKey) {
		logError(new Error('API_KEY not set'));
		return res.status(500).json({ error: 'Server auth is not configured' });
	}

	// Auth behavior:
	// - If header missing AND route is protected -> 401
	// - If header present but invalid -> 403
	if (!providedKey) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
	if (providedKey !== expectedKey) {
		return res.status(403).json({ error: 'Forbidden' });
	}

	return next();
};

module.exports = { authenticate };
