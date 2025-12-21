const tokens = new Map();

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

module.exports = { storeToken, getToken, clearToken, isTokenExpired };
