const { requireAuth, corsHeaders } = require('./_lib/auth.js');


function makeSeries(days) {
const today = new Date();
const out = [];
for (let i = days - 1; i >= 0; i--) {
const d = new Date(today);
d.setDate(today.getDate() - i);
const label = d.toISOString().slice(0, 10);
const value = Math.floor(20 + Math.random() * 30);
out.push({ date: label, calls: value });
}
return out;
}


module.exports.handler = async (event) => {
const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET';
if (method === 'OPTIONS') {
return { statusCode: 200, headers: corsHeaders(event), body: '' };
}
try {
requireAuth(event);


const rawUrl = event.rawUrl || `http://x${event.path}`;
const url = new URL(rawUrl);
const window = (url.searchParams.get('window') || '7d').toLowerCase();
const n = window.endsWith('d') ? parseInt(window, 10) : 7;


const series = makeSeries(isNaN(n) ? 7 : n);
return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify(series) };
} catch (e) {
return { statusCode: e.statusCode || 401, headers: corsHeaders(event), body: JSON.stringify({ error: e.message || 'unauthorized' }) };
}
};
