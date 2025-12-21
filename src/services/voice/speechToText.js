const { Readable } = require('stream');
const OpenAI = require('openai');
const { logError } = require('../../utils/logger');

const openai = process.env.OPENAI_API_KEY
	? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
	: null;

const transcribeAudio = async ({ buffer, filename = 'audio.webm', mimeType }) => {
	if (!openai) throw new Error('OPENAI_API_KEY is not configured');
	if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('Audio buffer is required');

	const stream = Readable.from(buffer);

	try {
		const response = await openai.audio.transcriptions.create({
			model: 'whisper-1',
			file: stream,
			filename,
			...(mimeType ? { mimeType } : {}),
		});
		return response.text?.trim() || '';
	} catch (err) {
		logError(err, { endpoint: 'voice-transcribe' });
		throw new Error('Failed to transcribe audio');
	}
};

module.exports = { transcribeAudio };
