const { Client } = require('@hubspot/api-client');
const { logError } = require('../../utils/logger');

const DEAL_PROPERTIES = ['dealname', 'amount', 'dealstage', 'closedate'];

const normalizeDeals = (results = []) => {
	return results.map((deal) => {
		const props = deal?.properties || {};
		return {
			name: props.dealname || 'Unnamed Deal',
			amount: props.amount ? Number(props.amount) : undefined,
			stage: props.dealstage,
			closeDate: props.closedate,
		};
	});
};

const getDeals = async (token) => {
	if (!token?.accessToken) {
		throw new Error('HubSpot access token is missing');
	}

	try {
		const client = new Client({ accessToken: token.accessToken });
		const dealsPage = await client.crm.deals.basicApi.getPage(20, undefined, DEAL_PROPERTIES, undefined, undefined, false);
		const results = dealsPage?.results || dealsPage?.body?.results || [];
		const leads = normalizeDeals(results);

		if (!leads.length) {
			throw new Error('No deals found in HubSpot for this account');
		}

		return {
			leads,
			metadata: { source: 'hubspot', total: leads.length },
		};
	} catch (err) {
		logError(err, { endpoint: 'hubspot-deals' });
		throw new Error('Failed to fetch HubSpot deals');
	}
};

module.exports = { getDeals };
