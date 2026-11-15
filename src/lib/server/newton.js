import { ATAI_API_KEY, ATAI_API_ENDPOINT } from '$env/static/private';

// Newton C 2.6 on the Inference API.
const MODEL = 'newton-c-2.6';

function apiUrl(path) {
	const root = ATAI_API_ENDPOINT.replace(/\/$/, '').replace(/\/api$/, '');
	return `${root}/api${path}`;
}

// The Inference API stops a query after about 58 seconds and generates more
// slowly than Direct Query did, so answers are kept short: the last sentence of
// the prompt asks for under 300 words, and MAX_NEW_TOKENS caps the rest.
const INSTRUCTION_PROMPT =
	'You are an energy grid analyst AI monitoring the California Independent System Operator (CAISO) power grid in real-time. ' +
	'You help users understand grid conditions, generation mix, demand patterns, and renewable energy performance. ' +
	'Key concepts: the "duck curve" (midday solar surplus followed by evening ramp), renewable curtailment, ' +
	'net demand (demand minus renewables), grid stress during peak hours (typically 4-9 PM), and battery dispatch patterns. ' +
	'California targets 100% clean energy by 2045. CAISO manages ~80% of California\'s electric flow. ' +
	'All values are in megawatts (MW). Data is 5-minute intervals from CAISO Today\'s Outlook. ' +
	'Keep each answer under 300 words: lead with the direct answer, then the few facts from the data ' +
	'that support it, using short bullet lists.';

const MAX_NEW_TOKENS = 1536;
// Listing numbers, the model can fall into a loop until it runs out of tokens
// or time. A mild repetition penalty breaks it. /inference/query applies it;
// Chat Completions ignores it.
const REPETITION_PENALTY = 1.1;

export async function queryNewton(query) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 90000);

	try {
		const res = await fetch(apiUrl('/inference/query'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ATAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: MODEL,
				query,
				system_prompt: INSTRUCTION_PROMPT,
				max_new_tokens: MAX_NEW_TOKENS,
				repetition_penalty: REPETITION_PENALTY
			}),
			signal: controller.signal
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST /api/inference/query failed: ${res.status} - ${JSON.stringify(err)}`);
		}

		const data = await res.json();
		const inner = data?.response;
		if (inner?.success === false) throw new Error(`Model returned success=false: ${JSON.stringify(inner)}`);
		const text = Array.isArray(inner?.response) ? inner.response[0] : inner?.response;
		if (typeof text !== 'string' || !text.trim()) throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
		return text.trim();
	} finally {
		clearTimeout(timeoutId);
	}
}
