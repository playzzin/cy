// Real page and browser, synthetic services only. All external requests are blocked.
process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/advance-cancel');

async function buildPreview() {
    const compiler = webpack({
        mode: 'development', devtool: false, context: root,
        entry: path.join(root, 'fixtures/advance-cancel-preview/index.tsx'),
        output: { path: output, filename: 'preview.js' },
        resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
                presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
            } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), {
                loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({
                    content: [path.join(root, 'src/pages/payroll/WorkerAdvanceRequestPage.tsx'), path.join(root, 'src/pages/payroll/components/*.tsx')],
                })] } },
            }] },
        ] },
        plugins: [new webpack.NormalModuleReplacementPlugin(/(?:services[\\/](?:requestWorkerService|manpowerService|userService|dailyReportService|advancePaymentService|advanceRequestService)|contexts[\\/]AuthContext|config[\\/]firebase)$/,
            path.join(root, 'fixtures/advance-cancel-preview/mocks.tsx'))],
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
        if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only')));
        else resolve();
    })));
}

(async () => {
    await buildPreview();
    const browser = await launch();
    const results = [];
    try {
        for (const width of [360, 390, 1366]) {
            const mobile = width < 768;
            const context = await browser.newContext({ viewport: { width, height: 850 }, hasTouch: mobile, isMobile: mobile });
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:4193') return route.abort();
                if (url.pathname === '/preview.js') return route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(output, 'preview.js')) });
                if (url.pathname !== '/') return route.abort();
                return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
            await page.goto('http://127.0.0.1:4193/');
            await page.getByRole('button', { name: '신청 취소', exact: true }).waitFor();
            await page.getByRole('combobox', { name: '신청 내역 분류' }).selectOption('first');
            const shortcut = page.getByRole('button', { name: mobile ? '가상작업자 신청 내역·취소' : '신청 내역·취소', exact: true });
            if (mobile) await shortcut.tap(); else await shortcut.click();
            assert.equal(await page.getByRole('combobox', { name: '신청 내역 분류' }).inputValue(), 'all');
            const heading = page.getByRole('heading', { name: '가상작업자', exact: true });
            assert.equal(await heading.evaluate(element => element === document.activeElement), true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.getByRole('button', { name: '신청 취소', exact: true }).count(), 1, 'Approved/paid requests have no cancel action');
            const cancel = page.getByRole('button', { name: '신청 취소', exact: true });
            const request = page.getByRole('article').filter({ has: cancel });
            await page.screenshot({ path: path.join(output, `before-${width}.png`), fullPage: true });
            page.once('dialog', dialog => dialog.dismiss());
            await cancel.click();
            assert.equal(await request.getByText('신청', { exact: true }).count(), 1);
            page.once('dialog', dialog => dialog.accept());
            await cancel.click();
            await page.getByRole('status').filter({ hasText: '신청을 취소했습니다.' }).waitFor();
            await page.getByRole('article').getByText('취소', { exact: true }).waitFor();
            assert.equal(await page.getByRole('button', { name: '신청 취소', exact: true }).count(), 0);
            await page.getByText('100,000원', { exact: true }).first().waitFor();
            await page.screenshot({ path: path.join(output, `after-${width}.png`), fullPage: true });
            await page.reload();
            await page.getByRole('article').getByText('취소', { exact: true }).waitFor();
            assert.equal(await page.getByRole('button', { name: '신청 취소', exact: true }).count(), 0);
            assert.deepEqual(errors, []);
            results.push({ width, shortcut: true, filterReset: true, confirmation: true, cancel: true, balanceRestored: true, retainedAfterReload: true, processedProtected: true });
            await context.close();
        }
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
