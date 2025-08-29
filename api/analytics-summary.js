const { requireAuth, corsHeaders } = require('./_lib/auth.js');

module.exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(event), body: '' };
  }

  try {
    requireAuth(event);

    const url = new URL(event.rawUrl || `http://x${event.path}?${event.queryStringParameters || ''}`);
    const window = url.searchParams.get('window') || '7d';

    // synthesize a simple summary for demo (static values). Replace with DB later.
    const summary = {
      window,
      total_call_minutes: 132,
      number_of_calls: 78,
      interactions: 245,
      avg_interactions_per_conversation: 3.1,
      top_topics: ['Onboarding', 'Sales', 'Support'],
      top_misunderstood: ['reschedule policy', 'payment link'],
    };

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify(summary),
    };
  } catch (e) {
    return {
      statusCode: e.statusCode || 401,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: e.message || 'unauthorized' }),
    };
  }
};
