const { Client } = require('@hubspot/api-client');
const { logError } = require('../../utils/logger');

const HUBSPOT_SCOPES = ['crm.objects.deals.read'];

const getConfig = () => {
	const { HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_REDIRECT_URI } = process.env;
	if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET || !HUBSPOT_REDIRECT_URI) {
		throw new Error('HubSpot OAuth env vars are missing');
	}

	return {
		clientId: HUBSPOT_CLIENT_ID,
		clientSecret: HUBSPOT_CLIENT_SECRET,
		redirectUri: HUBSPOT_REDIRECT_URI,
	};
};

const getAuthUrl = (state = 'dev') => {
	const { clientId, clientSecret, redirectUri } = getConfig();
	const client = new Client({ clientId, clientSecret, redirectUri });
	const scope = HUBSPOT_SCOPES.join(' ');

	return client.oauth.getAuthorizationUrl(clientId, redirectUri, scope, undefined, state);
};

const exchangeCodeForToken = async (code) => {
	const { clientId, clientSecret, redirectUri } = getConfig();
	if (!code) {
		throw new Error('Authorization code is required');
	}

	try {
		const client = new Client({ clientId, clientSecret, redirectUri });
		const tokenResponse = await client.oauth.tokensApi.create(
			'authorization_code',
			code,
			redirectUri,
			clientId,
			clientSecret
		);

		const payload = tokenResponse?.body || tokenResponse;
		const expiresAt = payload?.expiresIn ? Date.now() + payload.expiresIn * 1000 : undefined;

		return {
			accessToken: payload?.accessToken,
			refreshToken: payload?.refreshToken,
			expiresAt,
		};
	} catch (err) {
		logError(err, { endpoint: 'hubspot-oauth' });
		throw new Error('Failed to exchange HubSpot authorization code');
	}
};

module.exports = { getAuthUrl, exchangeCodeForToken };
