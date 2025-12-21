const validateCRMData = (data) => {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('CRM data must be an object');
	}

	if (!Array.isArray(data.leads) || data.leads.length === 0) {
		throw new Error('CRM data must include a non-empty leads array');
	}

	data.leads.forEach((lead, idx) => {
		if (!lead || typeof lead !== 'object') {
			throw new Error(`Lead at index ${idx} must be an object`);
		}
		if (!lead.name) {
			throw new Error(`Lead at index ${idx} is missing name`);
		}
	});
};

module.exports = { validateCRMData };
