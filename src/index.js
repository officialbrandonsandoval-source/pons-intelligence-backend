require('dotenv').config();
const express = require('express');

const rateLimiter = require('./middleware/rateLimiter');
const router = require('./flow/router');
const hubspotAuthRouter = require('./flow/hubspotAuth');
const copilotRouter = require('./flow/copilotRouter');
const { logRequest } = require('./utils/logger');
const voiceRouter = require('./flow/voiceRouter');

const app = express();

const warnOnMissingEnv = () => {
	const required = ['API_KEY'];
	const recommended = [
		// Voice features
		'OPENAI_API_KEY',
		// HubSpot OAuth
		'HUBSPOT_CLIENT_ID',
		'HUBSPOT_CLIENT_SECRET',
		'HUBSPOT_REDIRECT_URI',
	];

	const missingRequired = required.filter((k) => !process.env[k]);
	if (missingRequired.length) {
		// eslint-disable-next-line no-console
		console.warn(
			`[pons-intelligence] Missing required env: ${missingRequired.join(
				', '
			)} (API auth will fail until provided)`
		);
	}

	const missingRecommended = recommended.filter((k) => !process.env[k]);
	if (missingRecommended.length) {
		// eslint-disable-next-line no-console
		console.warn(
			`[pons-intelligence] Missing optional env: ${missingRecommended.join(
				', '
			)} (some integrations may be unavailable)`
		);
	}
};

warnOnMissingEnv();

const buildAllowedOrigins = () => {
	const origins = new Set();
	// Dev frontend
	origins.add('http://localhost:5173');
	// Preferred single-origin override (for deployments)
	if (process.env.FRONTEND_URL) origins.add(String(process.env.FRONTEND_URL).trim());
	// Optional: comma-separated list for production.
	// Example: https://app.yourdomain.com,https://admin.yourdomain.com
	const extra = String(process.env.CORS_ORIGINS || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	for (const o of extra) origins.add(o);
	return origins;
};

const allowedOrigins = buildAllowedOrigins();

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && allowedOrigins.has(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Vary', 'Origin');
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, x-api-key, Authorization, Accept'
	);
	res.setHeader('Access-Control-Allow-Credentials', 'true');

	if (req.method === 'OPTIONS') {
		return res.status(204).end();
	}
	return next();
});

app.use(express.json());
app.use(rateLimiter);
app.use(logRequest);

// Health check should always return JSON (and should not be overridden by any frontend/dev server).
app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		service: 'pons-intelligence-backend',
		timestamp: new Date().toISOString(),
	});
});

app.use('/api', voiceRouter);
app.use('/api', hubspotAuthRouter);
app.use('/api', copilotRouter);
app.use('/api', router);

// Fallback error handler to keep errors consistent
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	const status = err.status || 500;
	res.status(status).json({
		error: err.message || 'Internal Server Error',
	});
});

const port = process.env.PORT || 3000;

if (require.main === module) {
	app.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`[pons-intelligence] API listening on :${port}`);
	});
}

module.exports = app;
