/**
 * Shared CORS proxy handler for SHEEN.
 *
 * Routes external API/asset requests through the same origin so the web
 * preview can talk to F-Droid, IzzyOnDroid, and GitHub without hitting
 * browser CORS restrictions. Only whitelisted hosts are forwarded to avoid
 * turning the server into an open relay.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, https).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const ALLOWED_HOSTS = new Set([
  'f-droid.org',
  'www.f-droid.org',
  'apt.izzysoft.de',
  'www.izzysoft.de',
  'img.izzysoft.de',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
  'github-releases.githubusercontent.com',
  'gitlab.com',
  'fdroid.gitlab.io',
]);

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
];

const REPO_CACHE = new Map();
const CACHE_TTL = 3600000; // 1 hour

function isAllowedHost(url) {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function fetchRepoData(url) {
  if (REPO_CACHE.has(url) && (Date.now() - REPO_CACHE.get(url).timestamp < CACHE_TTL)) {
    return REPO_CACHE.get(url).data;
  }

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = [];
      res.on('data', (chunk) => { data.push(chunk); });
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(data);
          const parsed = JSON.parse(buffer.toString());
          REPO_CACHE.set(url, { data: parsed, timestamp: Date.now() });
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function handleCorsProxy(req, res) {
  const url = new URL(req.url, `http://localhost`);
  const targetUrl = url.searchParams.get('url');

  if (targetUrl && (targetUrl.includes('f-droid.org') || targetUrl.includes('izzysoft.de')) && targetUrl.endsWith('.json')) {
    fetchRepoData(targetUrl)
      .then(data => {
        setCorsHeaders(res);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        console.error('[CORS proxy] error fetching repo:', err.message);
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('Bad gateway');
      });
    return;
  }

  if (!targetUrl) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Missing url query parameter');
    return;
  }

  if (!isAllowedHost(targetUrl)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Target host is not allowed');
    return;
  }

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Invalid target URL');
    return;
  }

  const client = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };

  // Remove hop-by-hop headers and override the host header for the target.
  HOP_BY_HOP_HEADERS.forEach((h) => delete headers[h]);
  delete headers.host;
  headers.host = target.host;

  const options = {
    method: req.method,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    headers,
  };

  const proxyReq = client.request(options, (proxyRes) => {
    setCorsHeaders(res);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[CORS proxy] error fetching target:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Bad gateway');
    }
  });

  req.pipe(proxyReq);
}

module.exports = { handleCorsProxy };
