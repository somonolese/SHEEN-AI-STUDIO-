/**
 * Development reverse proxy for the SHEEN web preview.
 *
 * Runs the Expo web dev server on an internal port and exposes it on the
 * port Replit expects (5000 by default). Also exposes a same-origin CORS
 * proxy at /api/proxy so the web preview can load F-Droid/Izzy/GitHub data
 * without tripping browser CORS restrictions.
 *
 * Requires the http-proxy package (dev dependency).
 */

const http = require('http');
const httpProxy = require('http-proxy');
const { spawn } = require('child_process');
const path = require('path');
const { handleCorsProxy } = require('./proxy');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPO_WEB_PORT = parseInt(process.env.EXPO_WEB_PORT || '8082', 10);
const PROXY_PORT = parseInt(process.env.PORT || '5000', 10);
const MAX_STARTUP_WAIT_MS = 120_000;

function startExpo() {
  const env = {
    ...process.env,
    EXPO_PACKAGER_PROXY_URL: process.env.APP_URL,
    EXPO_PUBLIC_DOMAIN: process.env.APP_URL ? new URL(process.env.APP_URL).host : 'localhost',
    REACT_NATIVE_PACKAGER_HOSTNAME: process.env.APP_URL ? new URL(process.env.APP_URL).host : 'localhost',
  };

  console.log(
    `Starting Expo web dev server on port ${EXPO_WEB_PORT} (this may take a moment)...`,
  );

  const proc = spawn(
    'npx',
    ['expo', 'start', '--localhost', '--port', String(EXPO_WEB_PORT)],
    {
      cwd: PROJECT_ROOT,
      env,
      stdio: 'inherit',
      shell: false,
    },
  );

  return proc;
}

function waitForExpoReady() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let resolved = false;

    const check = () => {
      if (resolved) return;
      if (Date.now() - startTime > MAX_STARTUP_WAIT_MS) {
        resolved = true;
        reject(new Error('Expo web dev server did not start in time'));
        return;
      }

      const req = http.get(
        `http://127.0.0.1:${EXPO_WEB_PORT}/`,
        { timeout: 2000 },
        (res) => {
          if (resolved) return;
          if (res.statusCode === 200) {
            resolved = true;
            res.resume();
            console.log('Expo web dev server is ready');
            resolve();
            return;
          }
          res.resume();
          setTimeout(check, 1000);
        },
      );
      req.on('error', () => {
        if (!resolved) setTimeout(check, 1000);
      });
      req.on('timeout', () => {
        req.destroy();
        if (!resolved) setTimeout(check, 1000);
      });
    };
    check();
  });
}

async function main() {
  const expoProcess = startExpo();

  try {
    await waitForExpoReady();
  } catch (err) {
    expoProcess.kill();
    throw err;
  }

  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${EXPO_WEB_PORT}`,
    // changeOrigin: false, so it preserves the original Host
    changeOrigin: false,
    ws: true,
  });

  proxy.on('proxyReq', (proxyReq, req, res, options) => {
    // Delete Origin header so Expo's CorsMiddleware skips its check
    proxyReq.removeHeader('Origin');
  });

  proxy.on('proxyRes', (proxyRes, req, res) => {
    // Inject CORS header since we stripped the request Origin
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  });

  proxy.on('error', (err, req, res) => {
    console.error('[reverse proxy] error:', err.message);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Bad gateway');
    }
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    if (url.pathname === '/api/proxy') {
      handleCorsProxy(req, res);
      return;
    }

    proxy.web(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  server.on('error', (err) => {
    console.error('[server] error:', err.message);
    expoProcess.kill();
    process.exit(1);
  });

  server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(
      `SHEEN preview proxy listening on http://0.0.0.0:${PROXY_PORT}`,
    );
  });

  const cleanup = () => {
    expoProcess.kill();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => expoProcess.kill());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
