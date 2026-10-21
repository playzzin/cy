// Bundles the actual VAT page with synthetic, local-only service implementations.
process.env.NODE_ENV = 'development';
process.env.BABEL_ENV = 'development';
const webpack = require('webpack');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/quarter-vat-preview');
const output = path.join(root, 'artifacts/quarter-vat-preview');
const replacement = path.join(fixture, 'services.ts');
const compiler = webpack({
    mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
            babelrc: false, configFile: false, presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
        } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [
        new webpack.NormalModuleReplacementPlugin(/(?:services[\\/](?:companyService|siteService|teamService|accountDirectoryService|aiSettingsService|workbookLedgerService|quarterVatPaymentService|taxInvoiceBulkImportService)|contexts[\\/]AuthContext|components[\\/](?:TaxInvoiceBulkImportModal|WorkbookInputHotTable))$/, replacement),
    ],
});
compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) {
        console.error(error || stats.toString('errors-only'));
        process.exitCode = 1;
        return;
    }
    console.log('VAT preview build passed.');
    if (process.argv.includes('--build-only')) return;
    http.createServer((req, res) => {
        const file = path.join(output, path.basename(new URL(req.url, 'http://localhost').pathname));
        if (file.endsWith('.js') && fs.existsSync(file)) {
            res.setHeader('Content-Type', 'application/javascript');
            fs.createReadStream(file).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'");
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>분기 부가세 로컬 검증</title><style>body{margin:0;font-family:"Malgun Gothic",Arial,sans-serif}button,input,select{font:inherit}*{box-sizing:border-box}</style><div id="root"></div><script src="/preview.js"></script></html>');
        }
    }).listen(4198, '127.0.0.1', () => console.log('VAT preview: http://127.0.0.1:4198/payroll/workbook-ledger'));
});
