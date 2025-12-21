const OpenAI = require('openai');
const { logError } = require('../../utils/logger');

const openai = process.env.OPENAI_API_KEY
	? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
	: null;

const synthesizeSpeech = async (text) => {
	if (!openai) throw new Error('OPENAI_API_KEY is not configured');
	if (!text || !text.trim()) throw new Error('Text is required');

	try {
		const speech = await openai.audio.speech.create({
			model: 'gpt-4o-mini-tts',
			voice: 'alloy',
			format: 'mp3',
			input: text,
		});
		const buffer = Buffer.from(await speech.arrayBuffer());
		return buffer;
	} catch (err) {
		logError(err, { endpoint: 'voice-tts' });
		throw new Error('Failed to synthesize speech');
	}
};

module.exports = { synthesizeSpeech };
