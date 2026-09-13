#!/usr/bin/env node
// Single-origin static file server + reverse proxy for mobile testing, mirroring
// docker/nginx.conf's path-prefixed /api/<service>/ mapping so the Flutter web build
// (compiled with the same relative API base URLs docker/web.Dockerfile uses) can be
// fronted by ONE port. That single origin is what makes a cloudflared/mkcert HTTPS
// tunnel in front of it give a real secure context — the browser Geolocation API
// refuses to run at all on a plain-HTTP LAN origin (see
// apps/stranger_flutter/lib/core/location_service.dart's insecureOrigin comment) —
// and it avoids mixed-content blocking, since API calls become same-origin relative
// paths instead of separate http://<lan-ip>:300x origins.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../apps/stranger_flutter/build/web');
const PORT = Number(process.env.MOBILE_PROXY_PORT || 8080);
const HOST = process.env.MOBILE_PROXY_HOST || '0.0.0.0';
const BACKEND_HOST = process.env.MOBILE_PROXY_BACKEND_HOST || '127.0.0.1';

// Keep in sync with docker/nginx.conf.
const SERVICE_PORTS = {
  'identity-profile': 3001,
  offer: 3002,
  'discovery-location': 3003,
  participation: 3004,
  messaging: 3005,
  'trust-safety': 3006,
  'entitlements-billing': 3007,
  notification: 3008,
  media: 3009,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

function proxyToService(service, req, res) {
  const port = SERVICE_PORTS[service];
  const prefix = `/api/${service}/`;
  const forwardPath = req.url.slice(prefix.length - 1); // keep leading '/'

  const upstreamReq = http.request(
    {
      host: BACKEND_HOST,
      port,
      method: req.method,
      path: forwardPath,
      headers: { ...req.headers, host: `${BACKEND_HOST}:${port}` },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Bad gateway: ${service} (${err.code || err.message})`);
  });

  req.pipe(upstreamReq);
}

function serveStatic(req, res) {
  const requestedPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, requestedPath);

  // try_files $uri $uri/ /index.html — never resolve outside ROOT.
  if (!filePath.startsWith(ROOT)) {
    filePath = ROOT;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        fs.readFile(path.join(ROOT, 'index.html'), (fallbackErr, fallback) => {
          if (fallbackErr) {
            res.writeHead(404, { 'content-type': 'text/plain' });
            res.end('Not found — did you run `flutter build web --release`?');
            return;
          }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(fallback);
        });
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const match = req.url.match(/^\/api\/([a-z-]+)\//);
  if (match && SERVICE_PORTS[match[1]] !== undefined) {
    proxyToService(match[1], req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Mobile proxy serving ${ROOT}`);
  console.log(`Listening on http://${HOST}:${PORT} (proxying /api/<service>/ to ${BACKEND_HOST}:300x)`);
});
