// Local visual QA: actual pages, synthetic services, no network writes.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/team-resource-status-preview');
const output = path.join(root, 'artifacts/team-resource-status-20261019/preview');
const replacements = ['services/manpowerService', 'services/teamService', 'services/siteService', 'services/dailyReportService', 'services/teamResourceStatusService', 'contexts/AuthContext', 'routes/TeamWorkflowGate', 'hooks/useWorkerAccessScope'];
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
        ...replacements.map(name => new webpack.NormalModuleReplacementPlugin(new RegExp(name.replace('/', '[\\\\/]') + '$'), path.join(fixture, 'mocks.ts'))),
        new webpack.NormalModuleReplacementPlugin(/config[\\/]firebase$/, path.join(fixture, 'firebase.ts')),
    ],
});
compiler.run((error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; return; }
    compiler.close(() => {});
    http.createServer((req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'");
        const pathname = new URL(req.url, 'http://127.0.0.1:42763').pathname;
        const local = path.resolve(output, '.' + pathname);
        if (pathname.endsWith('.js') && local.startsWith(output + path.sep) && fs.existsSync(local)) {
            res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(local).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>팀 상태 변경 가상 검증</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f4f6fa}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:wait}p{line-height:1.6}.text-red-700{color:#b91c1c}.flex{display:flex}.flex-wrap{flex-wrap:wrap}.gap-2{gap:8px}.mb-3{margin-bottom:12px}.text-sm{font-size:14px}</style><div id="root"></div><script src="/preview.js"></script></html>');
        }
    }).listen(42763, '127.0.0.1', () => console.log('Synthetic preview: http://127.0.0.1:42763'));
});
