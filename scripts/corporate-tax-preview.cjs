// Production page, synthetic data only. Firebase services are replaced at build time.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/corporate-tax-preview');
const output = path.join(root, 'artifacts/corporate-tax-preview');
const compiler = webpack({
    mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [
        new webpack.NormalModuleReplacementPlugin(/services\/corporateTaxService$/, path.join(fixture, 'service.ts')),
        new webpack.NormalModuleReplacementPlugin(/services\/officeStaffPayrollService$/, path.join(fixture, 'payrollService.ts')),
        new webpack.NormalModuleReplacementPlugin(/services\/officeStaffService$/, path.join(fixture, 'staffService.ts')),
        new webpack.NormalModuleReplacementPlugin(/config\/firebase$/, path.join(fixture, 'firebase.ts')),
    ],
});
compiler.run((error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; compiler.close(() => {}); return; }
    compiler.close(() => {});
    http.createServer((req, res) => {
        if (req.url === '/preview.js') {
            res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(output, 'preview.js')).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>법인세 로컬 검증</title><style>body{margin:0;font-family:"Malgun Gothic",Arial,sans-serif}button,input,select{font:inherit}*{box-sizing:border-box}</style><div id="root"></div><script src="/preview.js"></script></html>');
        }
    }).listen(4197, '127.0.0.1', () => console.log('Corporate tax fixture: http://127.0.0.1:4197/payroll/corporate-tax'));
});
