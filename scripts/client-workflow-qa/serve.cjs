const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { root, admin } = require('./state.cjs');
const seed = require('./seed.cjs');
const appDir = path.join(root, 'artifacts/client-workflow-qa/app');
const modules = ['teamAccountApprovals', 'teamScopedRead', 'teamAdvanceRequests', 'teamOffDutyRequests', 'accountAccess', 'roleClaims', 'teamWorkerRequests', 'teamExpenseRequests'];
// The browser uses the real callable SDK, authentication, server handlers and Rules.
// Only the local HTTPS transport is adapted; no deployed Functions are contacted.
const handlers = Object.assign({}, ...modules.map(name => require(path.join(root, `functions/lib/${name}.js`))));
function startCallables() {
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4195');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const name = new URL(req.url, 'http://127.0.0.1').pathname.split('/').pop();
    try {
      if (req.method !== 'POST' || !handlers[name]?.run) throw Object.assign(new Error('QA transport does not expose this function.'), { code: 'not-found' });
      const token = await admin.auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1000000) throw new Error('request-too-large'); }
      const result = await handlers[name].run(JSON.parse(body).data, { auth: { uid: token.uid, token } });
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ result }));
    } catch (error) {
      const code = error.code || 'internal';
      console.log(`QA callable ${name}: ${code}`);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(code === 'permission-denied' ? 403 : code === 'not-found' ? 404 : 400);
      res.end(JSON.stringify({ error: { status: code.toUpperCase().replace(/-/g, '_'), message: error.message } }));
    }
  }).listen(15019, '127.0.0.1');
}
(async () => {
  const seeded = await seed();
  startCallables();
  const scripts = JSON.parse(fs.readFileSync(path.join(appDir, 'entry.json'))).map(name => `<script src="/${name}"></script>`).join('');
  http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:18089 http://127.0.0.1:19099 http://127.0.0.1:19199 http://127.0.0.1:15019; object-src 'none'");
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__qa/ready') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ project: 'demo-client-workflow', ...seeded })); return; }
    for (const directory of [appDir, path.join(root, 'public')]) {
      const target = path.resolve(directory, `.${pathname}`);
      if (target.startsWith(directory + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) {
        res.setHeader('Content-Type', pathname.endsWith('.js') ? 'application/javascript' : pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.svg') ? 'image/svg+xml' : pathname.endsWith('.png') ? 'image/png' : 'application/octet-stream');
        fs.createReadStream(target).pipe(res); return;
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로컬 합성 자료 검수</title><div id="root"></div>${scripts}</html>`);
  }).listen(4195, '127.0.0.1', () => console.log('QA ready: http://127.0.0.1:4195 (synthetic data only)'));
})().catch(error => { console.error(error.message); process.exit(1); });
