// Local browser QA. --live-ai enables the real server planner with existing credentials.
process.env.BABEL_ENV = 'development'; process.env.NODE_ENV = 'development';
const webpack = require('webpack'); const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const root = path.resolve(__dirname, '..'); const output = path.join(root, 'output/excel-converter-preview');
const port = Number(process.env.EXCEL_PREVIEW_PORT || 4189);
webpack({ mode: 'development', devtool: false, context: root, entry: path.join(root, 'fixtures/excel-converter-preview/index.tsx'), output: { path: output, filename: 'preview.js' }, resolve: { extensions: ['.tsx', '.ts', '.js'] }, module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } }, { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] }] } }, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exit(1); }
  const liveAi = process.argv.includes('--live-ai') ? require('./excel-converter-preview-ai.cjs').handleAi : null;
  http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/excel-converter/')) { if (liveAi) { await liveAi(req,res,url.pathname); return; } res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '로컬 AI 연결을 켜지 않았습니다. 예시 결과 먼저 확인을 사용하세요.' })); return; }
    if (url.pathname === '/settings/ai') { res.writeHead(302, { Location: 'http://localhost:3000/settings/ai#excel-conversion-ai' }); res.end(); return; }
    if (url.pathname === '/preview.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(output, 'preview.js')).pipe(res); return; }
    if (url.pathname.startsWith('/excel-converter/examples/')) {
      const file = path.basename(decodeURIComponent(url.pathname)); const target = path.join(root, 'public/excel-converter/examples', file);
      if (!fs.existsSync(target) || !file.endsWith('.xlsx')) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); fs.createReadStream(target).pipe(res); return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>엑셀 양식 변환 · 로컬 검증</title><style>body{margin:0}#test-banner{padding:7px 20px;background:#233d63;color:white;font:12px sans-serif}</style></head><body><div id="test-banner">로컬 검증 화면 · '+(liveAi?'실제 Gemini API 사용':'예시 변환 가능 · AI 연결 꺼짐')+'</div><div id="root"></div><script src="/preview.js"></script></body></html>');
  }).listen(port, '127.0.0.1', () => console.log(`Excel conversion preview: http://127.0.0.1:${port}/tools/excel-converter`));
});
