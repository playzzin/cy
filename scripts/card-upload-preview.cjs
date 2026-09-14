// Local, fixture-only visual QA. Never connects to Firebase or sends PDF contents.
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/card-upload-preview');
webpack({
  mode: 'development', devtool: false, context: root,
  entry: path.join(root, 'fixtures/card-upload-preview/index.tsx'),
  output: { path: output, filename: 'preview.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } }] },
  plugins: [new webpack.NormalModuleReplacementPlugin(/cardStatementImportService$/, path.join(root, 'fixtures/card-upload-preview/service.ts'))],
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exit(1); }
  const cssDir = path.join(root, '.deploy_completed_safe_20260903/build/static/css');
  const cssFile = fs.readdirSync(cssDir).find((name) => /^main\..*\.css$/.test(name));
  http.createServer((req, res) => {
    if (req.url === '/preview.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(output, 'preview.js')).pipe(res); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); fs.createReadStream(path.join(cssDir, cssFile)).pipe(res); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>카드 업로드 검증</title><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/preview.js"></script></html>'); }
  }).listen(4187, '127.0.0.1', () => console.log('Fixture-only preview: http://127.0.0.1:4187'));
});
