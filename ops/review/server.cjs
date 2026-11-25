const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const issuer = 'https://asia-northeast3-cyee-9c1e4.cloudfunctions.net/privateReviewSession';

function reviewServer({ directory, revision, authorize, exchange }) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('A full Git revision is required');
  const app = express();
  app.disable('x-powered-by');
  app.use(async (req, res, next) => {
    res.set({
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy':
        "frame-ancestors 'self'; object-src 'none'; worker-src 'none'; base-uri 'self'",
    });
    const assertion = req.get('x-goog-iap-jwt-assertion');
    if (!assertion) return res.sendStatus(403);
    try {
      await authorize(assertion);
    } catch {
      return res.sendStatus(403);
    }
    next();
  });
  app.post('/_review/session', async (req, res) => {
    if (req.get('x-cy-review') !== '1' || req.get('sec-fetch-site') !== 'same-origin')
      return res.sendStatus(403);
    try {
      const session = await exchange(req.get('x-goog-iap-jwt-assertion'));
      res.json(session);
    } catch {
      res.status(403).send('운영 계정과 조회 권한을 확인할 수 없습니다.');
    }
  });
  app.get('/_review/launch.js', (_req, res) =>
    res.sendFile(path.join(__dirname, 'launch.js'), { cacheControl: false }),
  );
  app.get(['/service-worker.js', '/asset-manifest.json'], (_req, res) => res.sendStatus(404));
  // Always go through the wrapper for HTML. The ERP bundle only runs in its authenticated frame.
  const assets = express.static(directory, { index: false, redirect: false, cacheControl: false });
  app.use((req, res, next) =>
    path.extname(req.path) && !req.path.endsWith('.html') ? assets(req, res, next) : next(),
  );
  app.get('*', (req, res) => {
    if (req.get('sec-fetch-dest') === 'iframe' && (!path.extname(req.path) || req.path === '/index.html')) {
      return res.sendFile(path.join(directory, 'index.html'), { cacheControl: false });
    }
    if (!req.accepts('html') || path.extname(req.path)) return res.sendStatus(404);
    res
      .type('html')
      .send(
        `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>청연ENG 비공개 검증</title><style>body{margin:0;font:16px system-ui;display:flex;flex-direction:column;height:100dvh}header{padding:.6em 1em;background:#fff2ba}iframe{border:0;flex:1;width:100%}button{margin-left:1em}</style><header>운영 자료 조회 전용 · <code>${revision.slice(0, 8)}</code> <span role="status"></span><button type="button" hidden>다시 연결</button></header><script src="/_review/launch.js" defer></script></html>`,
      );
  });
  return app;
}

if (require.main === module) {
  const { allowedReviewEmail } = require('./identity.js');
  const app = reviewServer({
    directory: path.join(__dirname, 'build'),
    revision: fs.readFileSync(path.join(__dirname, 'revision'), 'utf8').trim(),
    authorize: allowedReviewEmail,
    async exchange(assertion) {
      const response = await fetch(issuer, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { 'X-Cy-Review-Assertion': assertion },
      });
      if (!response.ok) throw new Error('Review authorization failed');
      return response.json();
    },
  });
  app.listen(Number(process.env.PORT || 8080));
}
module.exports = { reviewServer };
