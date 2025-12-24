require('dotenv').config();
const express = require('express');
const cors = require('cors');

const rateLimiter = require('./middleware/rateLimiter');
const router = require('./flow/router');
const hubspotAuthRouter = require('./flow/hubspotAuth');
const copilotRouter = require('./flow/copilotRouter');
const intelligenceRouter = require('./flow/intelligenceRouter');
const { logRequest } = require('./utils/logger');
const voiceRoutes = require('./routes/voice');
const { analyzeRevenue } = require('./intelligence/insightEngine');
const { authenticate } = require('./middleware/auth');

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
	// Production frontend
	origins.add('https://www.pons.solutions');
	origins.add('https://pons.solutions');
	return origins;
};

const allowedOrigins = buildAllowedOrigins();

// CORS (MUST run before all routes)
// Requirements:
// - Allow origin: https://www.pons.solutions
// - Allow origin: https://pons.solutions
// - Allow credentials
// - Allow headers: Content-Type, Authorization, x-api-key
// - Allow methods: GET, POST, OPTIONS
// - MUST respond to OPTIONS preflight with 204
app.use(
	cors({
		origin(origin, cb) {
			// Allow non-browser requests with no Origin header (health checks, server-to-server)
			if (!origin) return cb(null, true);
			return cb(null, allowedOrigins.has(origin));
		},
		credentials: true,
		methods: ['GET', 'POST', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
		optionsSuccessStatus: 204,
	})
);
// Note: Express 5 + path-to-regexp throws on `app.options('*', ...)`.
// The cors middleware above already handles preflights; we also return 200 for OPTIONS below.
app.use((req, res, next) => {
	if (req.method === 'OPTIONS') return res.sendStatus(204);
	return next();
});

// Body parsing MUST happen before routes so JSON endpoints never fall through to HTML.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(rateLimiter);
app.use(logRequest);

// Health check should always return JSON (and should not be overridden by any frontend/dev server).
app.get('/api/health', (req, res) => {
	// Demo contract:
	// GET /api/health -> 200 JSON { status: "ok" }
	// - synchronous
	// - never returns HTML
	return res.status(200).json({ status: 'ok' });
});

app.use('/api', hubspotAuthRouter);
app.use('/api', copilotRouter);
app.use('/api', intelligenceRouter);
app.use('/api', router);

// Requested mounts (compatibility):
// Mount existing routers at the paths the frontend expects.
// - /api/voice/session/start
// - /api/copilot
app.use('/api/voice', voiceRoutes);
app.use('/api/copilot', copilotRouter);

// Deterministic insight engine endpoint (no network calls)
// POST /api/insights { deals: [], now?: string }
app.post('/api/insights', authenticate, async (req, res, next) => {
	try {
		const { deals, now } = req.body || {};
		if (!Array.isArray(deals)) {
			return res.status(400).json({ error: 'deals must be an array' });
		}
		const out = await analyzeRevenue({ deals, now });
		return res.json(out);
	} catch (err) {
		return next(err);
	}
});

// JSON 404 (never return HTML)
app.use((req, res) => {
	res.status(404).json({ error: 'Not Found', path: req.path });
});

// Fallback error handler to keep errors consistent
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	const status = Number(err?.status || err?.statusCode || 500);
	const message =
		status >= 500
			? 'Internal Server Error'
			: err?.message || 'Request Error';

	// Ensure we always return JSON (never the default Express HTML error page)
	res.status(status).json({
		error: message,
		path: req.path,
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
