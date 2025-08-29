// Netlify function for user login.  Accepts an email
// and password and sets a cookie on success.  When
// DISABLE_AUTH=1 any credentials are accepted.  For
// demonstration purposes demo users may be provided via
// the DEMO_USERS environment variable as a JSON array
// of objects with email and password fields.

module.exports.handler = async (event) => {
  if ((event.httpMethod || event.requestContext?.http?.method) !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const email = body.email || '';
    const password = body.password || '';
    // If auth is disabled we just return the email
    if (process.env.DISABLE_AUTH === '1') {
      return {
        statusCode: 200,
        headers: {
          // Set a dummy cookie so the browser includes credentials on subsequent requests
          'Set-Cookie': `user=${encodeURIComponent(email)}; Path=/; HttpOnly`,
        },
        body: JSON.stringify({ email })
      };
    }
    // Try to authenticate against the DEMO_USERS list if provided
    const demo = process.env.DEMO_USERS ? JSON.parse(process.env.DEMO_USERS) : [];
    const user = demo.find(u => u.email === email && u.password === password);
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'invalid_credentials' }) };
    }
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': `user=${encodeURIComponent(email)}; Path=/; HttpOnly`,
      },
      body: JSON.stringify({ email })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'failed' }) };
  }
};