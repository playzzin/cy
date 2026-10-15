// Local browser QA against the actual pages, with synthetic services and stamps.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/certificate-preview');
const output = path.join(root, 'output/certificate-preview');
const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', chunkFilename: '[name].js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [new webpack.NormalModuleReplacementPlugin(/(?:companyService|manpowerService|useDocumentStamp)$/, path.join(fixture, 'services.ts'))],
});
compiler.run((error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; compiler.close(() => {}); return; }
    compiler.close(() => {});
    http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://127.0.0.1:4193').pathname;
        const local = path.resolve(output, `.${pathname}`);
        if (pathname.endsWith('.js') && local.startsWith(`${output}${path.sep}`) && fs.existsSync(local)) {
            res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(local).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>증명서 모바일 검증</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,input,select{font:inherit}</style><div id="root"></div><script src="/preview.js"></script></html>');
        }
    }).listen(4193, '127.0.0.1', () => console.log('Certificate fixture: http://127.0.0.1:4193/hr/certificate'));
});
