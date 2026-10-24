// Local-only visual QA with the actual page and mock authentication/services.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/team-expense-preview');
const output = path.join(fixture, '.build');
let started = false;
const compiler = webpack({
  mode: 'development', devtool: false, context: root,
  entry: path.join(fixture, 'index.tsx'),
  output: { path: output, filename: 'preview.js', chunkFilename: '[name].js', publicPath: '/' },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
    { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
  ] },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/teamExpenseRequestService$/, path.join(fixture, 'service.ts')),
    new webpack.NormalModuleReplacementPlugin(/contexts[\\/]AuthContext$/, path.join(fixture, 'auth.ts')),
    new webpack.NormalModuleReplacementPlugin(/useUnsavedRequestGuard$/, path.join(fixture, 'guard.ts')),
  ],
});
compiler.watch({ aggregateTimeout: 100, ignored: /node_modules|\.build/ }, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); return; }
  console.log(`Fixture compiled at ${new Date().toISOString()}`);
  if (started) return;
  started = true;
  http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src blob: data:");
    const pathname = new URL(req.url, 'http://127.0.0.1:4188').pathname;
    const local = path.resolve(output, `.${pathname}`);
    if (pathname.endsWith('.js') && local.startsWith(`${output}${path.sep}`) && fs.existsSync(local)) {
      res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(local).pipe(res);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가상 팀 경비 모바일 검증</title><div id="root"></div><script src="/preview.js"></script></html>');
    }
  }).listen(4188, '127.0.0.1', () => console.log('Fixture-only preview ready: http://127.0.0.1:4188'));
});
