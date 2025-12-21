const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getAuthUrl, exchangeCodeForToken } = require('../services/hubspot/oauth');
const { storeToken } = require('../services/tokenStore');
const { logError } = require('../utils/logger');
const { wrapAsync } = require('../utils/apiWrapper');

const router = express.Router();

router.get(
	'/auth/hubspot',
	authenticate,
	wrapAsync(async (req, res) => {
		const userId = req.query.userId || 'dev';
		const url = getAuthUrl(userId);
		res.redirect(url);
	})
);

router.get(
	'/auth/hubspot/callback',
	wrapAsync(async (req, res) => {
		const { code, state } = req.query;
		if (!code) {
			return res.status(400).json({ error: 'Missing authorization code' });
		}

		try {
			const userId = state || 'dev';
			const token = await exchangeCodeForToken(code);
			storeToken(userId, token);
			return res.json({ message: 'HubSpot connected', userId, expiresAt: token.expiresAt });
		} catch (err) {
			logError(err, { endpoint: '/auth/hubspot/callback' });
			return res.status(400).json({ error: err.message });
		}
	})
);

module.exports = router;
