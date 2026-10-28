// Render the real account page and modal with synthetic, local-only services.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/worker-direct-pay-preview');
const output = path.join(root, 'artifacts/worker-direct-pay-preview');
const compiler = webpack({
    mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [new webpack.NormalModuleReplacementPlugin(/(services\/(manpowerService|teamService|companyService|accountDirectoryService|primaryAccountService|workerBankPhotoService|aiSettingsService|geminiService|geminiGatewayClient|siteService|positionService|statisticsService|dailyReportService|identityDocumentLogService|teamScopedReadService)|\.\/geminiGatewayClient|contexts\/AuthContext|routes\/TeamWorkflowGate|config\/firebase|components\/accounts\/PagePrimaryAccountManager|components\/SecureSignature|components\/manpower\/(AccountLinkingModal|BulkProgressModal|BulkEditWorkerModal|IdCardAnalysisModal)|components\/signatures\/SignatureGeneratorModal|manpower\/WorkerModal)$/, path.join(fixture, 'services.ts'))],
});
compiler.run(async (error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exitCode = 1; compiler.close(() => {}); return; }
    compiler.close(() => {});
    const css = await require('postcss')([require('tailwindcss')({ content: [path.join(root, 'src/pages/database/AccountManagementPage.tsx'), path.join(root, 'src/pages/database/WorkerDatabase.tsx'), path.join(root, 'src/pages/manpower/WorkerSummaryPage.tsx'), path.join(root, 'src/components/accounts/*.tsx'), path.join(root, 'src/components/common/SingleSelectPopover.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    fs.writeFileSync(path.join(output, 'preview.css'), css.css);
    if (process.argv.includes('--build-only')) { console.log('Account preview built.'); return; }
    http.createServer((req, res) => {
        if (req.url === '/preview.js' || req.url === '/preview.css') {
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'text/css'); fs.createReadStream(path.join(output, req.url.slice(1))).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>직불용 계좌 검증</title><link rel="stylesheet" href="/preview.css"><body style="font-family:Arial,Malgun Gothic,sans-serif"><div id="root"></div><script src="/preview.js"></script></body></html>');
        }
    }).listen(4199, '127.0.0.1', () => console.log('Account preview: http://127.0.0.1:4199'));
});
