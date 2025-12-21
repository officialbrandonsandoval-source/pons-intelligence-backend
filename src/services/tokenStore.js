const tokens = new Map();

// GoHighLevel credentials are stored separately from HubSpot OAuth tokens.
// This is intentionally in-memory only; for production, swap to an encrypted KV/DB.
const ghlCredentials = new Map();

const storeToken = (userId, token) => {
	if (!userId) {
		throw new Error('userId is required to store a token');
	}
	if (!token || !token.accessToken) {
		throw new Error('A valid HubSpot token payload is required');
	}

	tokens.set(userId, { ...token, storedAt: Date.now() });
};

const getToken = (userId) => tokens.get(userId);

const clearToken = (userId) => tokens.delete(userId);

const isTokenExpired = (token) => {
	if (!token) return true;
	if (!token.expiresAt) return false;
	return Date.now() >= new Date(token.expiresAt).getTime();
};

const storeGhlCredentials = (userId, creds) => {
	if (!userId) throw new Error('userId is required to store GHL credentials');
	if (!creds || !creds.apiKey || !creds.locationId) {
		throw new Error('A valid GHL credentials payload is required');
	}
	ghlCredentials.set(userId, {
		apiKey: String(creds.apiKey).trim(),
		locationId: String(creds.locationId).trim(),
		storedAt: Date.now(),
	});
};

const getGhlCredentials = (userId) => ghlCredentials.get(userId);

const clearGhlCredentials = (userId) => ghlCredentials.delete(userId);

module.exports = {
	storeToken,
	getToken,
	clearToken,
	isTokenExpired,
	storeGhlCredentials,
	getGhlCredentials,
	clearGhlCredentials,
};
