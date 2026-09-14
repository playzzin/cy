// Local-only browser regression harness. No Firebase credentials or writes.
// Run after BUILD_PATH=.codex-artifacts/runtime-recovery-20260910/build npm run build.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const buildDir = path.resolve(__dirname, '../.codex-artifacts/runtime-recovery-20260910/build');
const requests = {};
const checkPage = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>CY 캐시 복구 검증</title>
<style>body{font:18px system-ui;margin:40px;background:#f8fafc;color:#0f172a}li{margin:14px 0}.fail{color:#be123c}.pass{color:#047857}</style>
<h1>CY 캐시 복구 브라우저 검증</h1><p id="status">검증 중</p><ol id="results"></ol>
<script>
const report = (label, success) => {
  const row = document.createElement('li'); row.className = success ? 'pass' : 'fail';
  row.textContent = (success ? '통과: ' : '실패: ') + label; document.querySelector('#results').append(row);
  if (!success) throw new Error(label);
};
const loadScript = (url) => new Promise((resolve) => {
  const script = document.createElement('script'); script.src = url;
  script.onload = () => { script.remove(); resolve(true); };
  script.onerror = () => { script.remove(); resolve(false); }; document.head.append(script);
});
(async () => {
  localStorage.setItem('runtime-check-preference', 'keep');
  sessionStorage.setItem('runtime-check-draft', 'keep');
  await caches.open('cy-erp-pwa-v4-assets'); await caches.open('runtime-check-unrelated');
  await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
  const cacheNames = await caches.keys();
  report('이전 버전 앱 캐시 교체', !cacheNames.includes('cy-erp-pwa-v4-assets'));
  report('다른 캐시 보존', cacheNames.includes('runtime-check-unrelated'));
  const cache = await caches.open('cy-erp-pwa-v5-assets');
  await cache.put('/static/js/runtime-check.abcdef12.js', new Response('<html>wrong</html>', {headers:{'Content-Type':'text/html'}}));
  await loadScript('/static/js/runtime-check.abcdef12.js');
  report('잘못 저장된 HTML을 정상 화면 파일로 복구', window.runtimeCheckLoaded === 1);
  await loadScript('/static/js/runtime-check.abcdef12.js');
  const counts = await (await fetch('/api/runtime-check-counts')).json();
  report('정상 파일은 캐시 재사용', counts['/static/js/runtime-check.abcdef12.js'] === 1 && window.runtimeCheckLoaded === 2);
  await loadScript('/static/js/runtime-check-missing.deadbeef.js');
  report('없는 파일의 HTML 응답을 캐시에 저장하지 않음', !(await cache.match('/static/js/runtime-check-missing.deadbeef.js')));
  await loadScript('/runtime-check-helper.js'); await loadScript('/runtime-check-helper.js');
  report('같은 주소의 변경된 보조 파일 갱신', window.runtimeCheckVersion === 2);
  report('설정과 임시 저장 데이터 보존', localStorage.getItem('runtime-check-preference') === 'keep' && sessionStorage.getItem('runtime-check-draft') === 'keep');
  document.querySelector('#status').textContent = '7개 항목 모두 통과';
})().catch(error => { document.querySelector('#status').textContent = '검증 실패: ' + error.message; });
</script></html>`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const send = (body, type, cache = 'no-store') => {
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  };
  if (pathname === '/__runtime-check') return send(checkPage, 'text/html; charset=utf-8');
  if (pathname === '/api/runtime-check-counts') return send(JSON.stringify(requests), 'application/json');
  if (pathname === '/service-worker.js') return send(fs.readFileSync(path.join(__dirname, '../public/service-worker.js')), 'text/javascript');
  if (pathname === '/static/js/runtime-check.abcdef12.js') {
    requests[pathname] = (requests[pathname] || 0) + 1;
    return send('window.runtimeCheckLoaded = (window.runtimeCheckLoaded || 0) + 1;', 'text/javascript');
  }
  if (pathname === '/runtime-check-helper.js') {
    requests[pathname] = (requests[pathname] || 0) + 1;
    return send('window.runtimeCheckVersion = ' + requests[pathname] + ';', 'text/javascript');
  }
  if (pathname === '/static/js/runtime-check-missing.deadbeef.js') {
    return send('<!doctype html><html>Hosting fallback</html>', 'text/html', 'public, max-age=31536000, immutable');
  }
  const target = path.resolve(buildDir, '.' + pathname);
  if (target.startsWith(buildDir + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) {
    return send(fs.readFileSync(target), mime[path.extname(target)] || 'application/octet-stream');
  }
  const index = path.join(buildDir, 'index.html');
  return send(fs.existsSync(index) ? fs.readFileSync(index) : '<!doctype html><html>CY build pending</html>', 'text/html');
});
server.listen(4318, '127.0.0.1', () => console.log('CY browser check: http://127.0.0.1:4318/__runtime-check'));
