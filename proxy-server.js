import http from 'http';

const TARGET_HOST = 'localhost';
const TARGET_PORT = 8080;
const PROXY_PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Relay POST requests to llama.cpp
  if (req.method === 'POST' && req.url.startsWith('/v1/')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: req.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      console.log(`[${new Date().toISOString()}] 📤 Forwarding POST ${req.url}`);
      console.log(`   Body size: ${body.length} bytes`);

      const proxyReq = http.request(options, (proxyRes) => {
        console.log(`[${new Date().toISOString()}] ✅ Received response: ${proxyRes.statusCode}`);
        // Remove conflicting CORS headers from origin server
        const headers = { ...proxyRes.headers };
        delete headers['access-control-allow-origin'];
        delete headers['access-control-allow-methods'];
        delete headers['access-control-allow-headers'];
        delete headers['access-control-allow-credentials'];

        res.writeHead(proxyRes.statusCode, {
          ...headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });

        proxyRes.pipe(res);
      });

      proxyReq.setTimeout(120000, () => {
        console.error(`[${new Date().toISOString()}] ⏱️  Proxy request timeout after 120s`);
        proxyReq.destroy();
        res.writeHead(504, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end(JSON.stringify({ error: 'Proxy timeout' }));
      });

      proxyReq.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ Proxy error: ${err.message}`);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`🔄 CORS Proxy listening on http://localhost:${PROXY_PORT}`);
  console.log(`📡 Forwarding requests to ${TARGET_HOST}:${TARGET_PORT}`);
});
