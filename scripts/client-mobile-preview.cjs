// Actual UI components with synthetic data only; no production credentials or network writes.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/client-mobile-preview');
const output = path.join(fixture, '.build');
const mocks = path.join(fixture, 'mocks.tsx');
let started = false;
const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), { loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({ content: [path.join(fixture, '*.tsx'), path.join(root, 'src/pages/jeonkuk/*.tsx'), path.join(root, 'src/pages/manpower/TeamWorkerDetailPage.tsx'), path.join(root, 'src/pages/payroll/WorkerAdvanceRequestPage.tsx'), path.join(root, 'src/components/payroll/TeamSettlementWorkspaceHeader.tsx'), path.join(root, 'src/components/common/MonthNavigator.tsx')] })] } } }] },
    ] },
    plugins: [new webpack.NormalModuleReplacementPlugin(/(?:services[\\/](?:manpowerService|teamService|dailyReportService|requestWorkerService|teamScopedReadService|teamSettlementService|userService|advancePaymentService|advanceRequestService|teamAccountApprovalService)|contexts[\\/](?:AuthContext|MasterDataContext)|utils[\\/]teamAccountApprovalFeature|hooks[\\/]useWorkerAccessScope|config[\\/]firebase|components[\\/]SecureSignature|components[\\/]common[\\/]OutputManagementTabs|components[\\/]signatures[\\/]SignatureGeneratorModal)$/, mocks)],
});
compiler.watch({ aggregateTimeout: 100, ignored: /node_modules|\.build/ }, (error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); return; }
    console.log('Client mobile synthetic preview compiled');
    if (started) return;
    started = true;
    http.createServer((req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; object-src 'none'");
        const pathname = new URL(req.url, 'http://127.0.0.1:4193').pathname;
        const local = path.resolve(output, `.${pathname}`);
        if (pathname.endsWith('.js') && local.startsWith(`${output}${path.sep}`) && fs.existsSync(local)) {
            res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(local).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>합성 자료 모바일 검증</title><div id="root"></div><script src="/preview.js"></script></html>');
        }
    }).listen(4193, '127.0.0.1', () => console.log('http://127.0.0.1:4193'));
});
