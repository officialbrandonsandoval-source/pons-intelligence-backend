const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { logError, logger } = require('../utils/logger');
const { transcribeAudio } = require('../services/voice/speechToText');
const { synthesizeSpeech } = require('../services/voice/textToSpeech');
const copilotRouter = require('./copilotRouter');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Log incoming voice routes without ever logging audio blobs.
// Required fields: method, path, userId, timestamp.
const logVoiceRequest = (req, res, next) => {
	const userId =
		(req.body && typeof req.body.userId === 'string' && req.body.userId.trim())
			? req.body.userId.trim()
			: 'unknown';
	logger.info('VOICE_REQUEST', {
		method: req.method,
		path: req.originalUrl,
		userId,
		timestamp: new Date().toISOString(),
	});
	return next();
};

const callCopilotInternally = (req, payload) =>
	new Promise((resolve, reject) => {
		// Call the copilot route handler without doing an HTTP roundtrip.
		// This keeps auth + behavior consistent and avoids dependency changes.
		const fakeReq = {
			body: payload,
			headers: {
				...req.headers,
				// ensure middleware that checks x-api-key sees the same key
				'x-api-key': req.headers['x-api-key'],
			},
		};

		const fakeRes = {
			statusCode: 200,
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(body) {
				if (this.statusCode >= 400) {
					const msg = body?.error || 'Copilot call failed';
					return reject(new Error(msg));
				}
				return resolve(body);
			},
		};

		// Mount path for this router is /api, and the copilot router defines POST /copilot.
		// We can invoke the handler by reusing the router stack. Simplest is to call the exported
		// router as middleware with matching URL/method.
		fakeReq.method = 'POST';
		fakeReq.url = '/copilot';

		copilotRouter.handle(fakeReq, fakeRes, (err) => {
			if (err) reject(err);
		});
	});


const voiceCommandHandler = async (req, res) => {
	try {
		if (!req.file?.buffer) return res.status(400).json({ error: 'Audio file is required' });

		const transcript = await transcribeAudio({
			buffer: req.file.buffer,
			filename: req.file.originalname || 'audio.webm',
			mimeType: req.file.mimetype,
		});

		let parsedData;
		if (req.body?.data) {
			try {
				parsedData = JSON.parse(req.body.data);
			} catch (err) {
				return res.status(400).json({ error: 'Invalid data JSON' });
			}
		}

		const userId = req.body?.userId || 'dev';
		const source = req.body?.source;
		if (!source) return res.status(400).json({ error: 'source is required' });

		const copilotPayload = {
			source,
			userId,
			query: transcript,
			mode: 'voice',
			// Allow callers to pass pre-fetched data (useful for troubleshooting)
			data: parsedData,
		};

		const copilot = await callCopilotInternally(req, copilotPayload);
		const responseText = copilot?.answer || copilot?.metrics?.nextBestAction?.text || 'Done.';

		let audioBase64;
		const returnAudio = String(req.body?.returnAudio || '').toLowerCase() === 'true';
		if (returnAudio) {
			const speechBuf = await synthesizeSpeech(responseText);
			audioBase64 = speechBuf.toString('base64');
		}

		return res.json({
			transcript,
			response: responseText,
			copilot,
			audioBase64,
		});
	} catch (err) {
		logError(err, { endpoint: '/voice/command' });
		return res.status(400).json({ error: err.message || 'Voice command failed' });
	}
};

// Start (or resume) a voice session.
// This is intentionally simple and deterministic: clients can call it to validate auth + CORS
// and to receive a session id they can attach to subsequent voice requests.
const voiceSessionStartHandler = async (req, res) => {
	try {
		// Match the production contract: { sessionId, status: 'ready' }
		// Keep this endpoint lightweight so it never depends on CRM state.
		const sessionId = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
		return res.json({ sessionId, status: 'ready' });
	} catch (err) {
		logError(err, { endpoint: '/voice/session/start' });
		return res.status(400).json({ error: err.message || 'Voice session start failed' });
	}
};

// Supports mounting under /api (preferred): POST /api/voice/command
router.post('/voice/command', authenticate, upload.single('audio'), logVoiceRequest, voiceCommandHandler);
// Also supports accidental double-prefix mounting: POST /api/api/voice/command
// (kept for compatibility in case a client hardcodes /api/voice/command while router is mounted at /)
router.post('/api/voice/command', authenticate, upload.single('audio'), logVoiceRequest, voiceCommandHandler);

// Required by the production frontend: POST /api/voice/session/start
router.post('/voice/session/start', authenticate, express.json(), logVoiceRequest, voiceSessionStartHandler);
router.post('/api/voice/session/start', authenticate, express.json(), logVoiceRequest, voiceSessionStartHandler);

router.post('/voice/speak', authenticate, express.json(), async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ error: 'text is required' });
		const buffer = await synthesizeSpeech(text);
		res.json({ audioBase64: buffer.toString('base64') });
	} catch (err) {
		logError(err, { endpoint: '/voice/speak' });
		res.status(400).json({ error: err.message || 'TTS failed' });
	}
});

router.post('/api/voice/speak', authenticate, express.json(), async (req, res) => {
	// Mirror route for compatibility
	try {
		const { text } = req.body;
		if (!text) return res.status(400).json({ error: 'text is required' });
		const buffer = await synthesizeSpeech(text);
		res.json({ audioBase64: buffer.toString('base64') });
	} catch (err) {
		logError(err, { endpoint: '/voice/speak' });
		res.status(400).json({ error: err.message || 'TTS failed' });
	}
});

module.exports = router;
