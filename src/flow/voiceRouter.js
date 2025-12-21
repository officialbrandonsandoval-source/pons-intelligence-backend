const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { logError } = require('../utils/logger');
const { transcribeAudio } = require('../services/voice/speechToText');
const { synthesizeSpeech } = require('../services/voice/textToSpeech');
const { executeVoiceCommand } = require('../services/voice/voiceCommands');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post('/voice/command', authenticate, upload.single('audio'), async (req, res) => {
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

		const result = await executeVoiceCommand({
			transcript,
			source: req.body?.source,
			userId: req.body?.userId,
			data: parsedData,
		});

		let audioBase64;
		const wantAudio = String(req.body?.wantAudio || '').toLowerCase() === 'true';
		if (wantAudio) {
			const speechBuf = await synthesizeSpeech(result.responseText);
			audioBase64 = speechBuf.toString('base64');
		}

		return res.json({
			transcript,
			intent: result.intent,
			response: result.responseText,
			insight: result.insight,
			audioBase64,
		});
	} catch (err) {
		logError(err, { endpoint: '/voice/command' });
		return res.status(400).json({ error: err.message || 'Voice command failed' });
	}
});

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

module.exports = router;
