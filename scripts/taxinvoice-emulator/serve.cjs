const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const webpack = require('webpack');
const { root, createClient, issue, seed, close } = require('./runtime.cjs');
process.env.BABEL_ENV = 'development';
const dist = path.join(root, 'artifacts/audits/taxinvoice-emulator-ui');

async function main() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const client = createClient('ui-seed');
  await seed(client.db, [
    issue('browser-a', { yearMonth: ym, issueDate: `${ym}-01`, recipient: '통합검증 A업체', teamName: '가팀' }),
    issue('browser-b', { yearMonth: ym, issueDate: `${ym}-02`, no: 2, recipient: '통합검증 B업체', supplyAmount: 200, teamName: '나팀' }),
    issue('browser-deferred', { yearMonth: prevYm, issueDate: `${prevYm}-01`, recipient: '통합검증 이월업체', supplyAmount: 500, issueStatus: 'deferred' }),
  ]);
  await close();
  const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(__dirname, 'entry.tsx'), output: { path: dist, filename: 'preview.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { babelrc: false, configFile: false, presets: [require.resolve('babel-preset-react-app')] } } }] },
    plugins: [new webpack.NormalModuleReplacementPlugin(/(?:config\/firebase|PayrollIssueTopTabs|dailyReportService|siteService|companyService)$/, resource => {
      resource.request = path.join(__dirname, resource.request.endsWith('config/firebase') ? 'firebase.ts' : resource.request.endsWith('PayrollIssueTopTabs') ? 'tabs.tsx' : 'fixtures.ts');
    })],
  });
  compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
    const cssDir = path.join(root, 'build/static/css');
    const css = fs.readdirSync(cssDir).filter(name => name.startsWith('main.') && name.endsWith('.css')).map(name => fs.readFileSync(path.join(cssDir, name), 'utf8')).join('\n');
    http.createServer((request, response) => {
      const pathname = request.url.split('?')[0];
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://127.0.0.1:18086; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'none'");
      if (pathname === '/preview.js' || /^\/[a-zA-Z0-9_-]+\.preview\.js$/.test(pathname)) {
        const target = path.join(dist, path.basename(pathname));
        if (!fs.existsSync(target)) { response.writeHead(404); response.end(); return; }
        response.setHeader('Content-Type', 'application/javascript'); response.end(fs.readFileSync(target));
      } else if (pathname === '/style.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
      else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>발행리스트 저장소 통합 검증</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'); }
    }).listen(3097, '127.0.0.1', () => console.log('Firestore-connected preview ready: http://127.0.0.1:3097'));
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
