// Actual activity center with synthetic reads; no authentication or production calls.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/activity-center-preview');
const output = path.join(root, 'artifacts/activity-center-preview');
const compiler = webpack({
  mode: 'development', devtool: false, context: root,
  entry: path.join(fixture, 'index.tsx'),
  output: { path: output, filename: 'preview.js', publicPath: '/' },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
    { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
  ] },
  plugins: [new webpack.NormalModuleReplacementPlugin(/(?:activityQuery|contexts[\\/]AuthContext|services[\\/](?:userService|geminiUsageLogService)|utils[\\/]devAdminSession)$/, path.join(fixture, 'mocks.ts'))],
});
compiler.run((error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; compiler.close(() => {}); return; }
  compiler.close(() => {});
  if (process.argv.includes('--build-only')) { console.log('Activity preview compiled.'); return; }
  http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:");
    const pathname = new URL(req.url, 'http://127.0.0.1:42775').pathname;
    const file = path.resolve(output, '.' + pathname);
    if (pathname.endsWith('.js') && file.startsWith(output + path.sep) && fs.existsSync(file)) {
      res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(file).pipe(res);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>활동 내역 미리보기</title><style>body{margin:0;background:#f8fafc;font-family:Arial,"Malgun Gothic",sans-serif}a{text-decoration:none}</style><div id="root"></div><script src="/preview.js"></script></html>');
    }
  }).listen(42775, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:42775'));
});
