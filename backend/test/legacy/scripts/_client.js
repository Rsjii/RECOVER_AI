const http = require('http');

function request({ port, method, path, body, cookie, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : '';

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch {}
          resolve({ status: res.statusCode, headers: res.headers, raw, json });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!Array.isArray(setCookie) || !setCookie.length) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

module.exports = { request, extractCookie };

