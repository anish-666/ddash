const { requireAuth, corsHeaders } = require('./_lib/auth.js');


module.exports.handler = async (event) => {
const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
if (method === 'OPTIONS') {
return { statusCode: 200, headers: corsHeaders(event), body: '' };
}
try {
requireAuth(event);


// Safely parse query param
const rawUrl = event.rawUrl || `http://x${event.path}`;
const url = new URL(rawUrl);
const window = url.searchParams.get('window') || '7d';


const summary = {
window,
total_call_minutes: 132,
number_of_calls: 78,
interactions: 245,
avg_interactions_per_conversation: 3.1,
top_topics: ['Onboarding', 'Sales', 'Support'],
top_misunderstood: ['reschedule policy', 'payment link']
};


return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(summary) };
} catch (e) {
return { statusCode: e.statusCode || 401, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'unauthorized' }) };
}
};
