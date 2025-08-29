// Netlify function that returns aggregated analytics
// metrics.  Without a backing database or provider
// integration this implementation synthesises values
// based on the requested window.  Each day yields a
// random call and interaction count to simulate
// realistic behaviour.

const { requireAuth } = require('./_lib/auth.js');

module.exports.handler = async (event) => {
  try {
    requireAuth(event);
    const params = event.queryStringParameters || {};
    const windowStr = params.window || '7d';
    const daysMatch = /^(\d+)d$/.exec(windowStr);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
    let totalCalls = 0;
    let totalMinutes = 0;
    let totalInteractions = 0;
    for (let i = 0; i < days; i++) {
      const calls = 5 + Math.floor(Math.random() * 10);
      const minutes = calls * (2 + Math.random() * 3);
      const interactions = calls * (3 + Math.random() * 2);
      totalCalls += calls;
      totalMinutes += minutes;
      totalInteractions += interactions;
    }
    const averageInteraction = totalCalls > 0 ? Math.round((totalInteractions / totalCalls) * 10) / 10 : 0;
    const summary = {
      window: windowStr,
      total_call_minutes: Math.round(totalMinutes),
      number_of_calls: totalCalls,
      average_interaction_count: averageInteraction,
      total_interactions: Math.round(totalInteractions)
    };
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (e) {
    const status = e.statusCode || 500;
    return { statusCode: status, body: JSON.stringify({ error: e.message || 'failed' }) };
  }
};