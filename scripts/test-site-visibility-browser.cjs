// Actual site page with synthetic reads; all external traffic is blocked.
process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/site-visibility-preview');
const output = path.join(root, 'artifacts/site-visibility-preview');
const origin = 'http://127.0.0.1:4198';

async function build() {
    const replacements = ['services/siteService', 'services/teamService', 'services/manpowerService',
        'services/dailyReportService', 'services/teamResourceStatusService', 'routes/TeamWorkflowGate',
        'hooks/useWorkerAccessScope', 'utils/swal'];
    const compiler = webpack({
        mode: 'development', devtool: false, context: root,
        entry: path.join(fixture, 'index.tsx'),
        output: { path: output, filename: 'preview.js', publicPath: '/' },
        resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
                presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
            } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
        ] },
        plugins: replacements.map(name => new webpack.NormalModuleReplacementPlugin(
            new RegExp(name.replace('/', '[\\\\/]') + '$'), path.join(fixture, 'mocks.ts'))),
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
        if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only')));
        else resolve();
    })));
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    await build();
    const browser = await launch();
    const results = [];
    try {
        for (const width of [390, 1366]) {
            for (const mode of ['menu', 'leader']) {
                const context = await browser.newContext({ viewport: { width, height: 900 } });
                await context.route('**/*', route => {
                    const url = new URL(route.request().url());
                    if (url.origin !== origin) return route.abort();
                    if (url.pathname === '/preview.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(output, 'preview.js')) });
                    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
                });
                const page = await context.newPage();
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                const siteButton = name => page.getByRole('button', { name: new RegExp(`가상 ${name}.*진행중`) });
                await page.goto(`${origin}/manpower/site-responsible-detail?mode=${mode}`);
                await siteButton('이번달현장').waitFor();
                assert.equal(await siteButton('미출력현장').count(), 0, `${mode}: 미출력 현장을 숨겨야 합니다`);
                assert.equal(await siteButton('영공수현장').count(), 0);
                assert.equal(await siteButton('지난달현장').count(), 0);
                assert.equal(await page.getByRole('option', { name: '진행중 현장 (1)' }).count(), 1);
                await page.screenshot({ path: path.join(output, `${mode}-${width}.png`), fullPage: true });
                await page.getByRole('button', { name: '이전 달', exact: true }).click();
                await siteButton('지난달현장').waitFor();
                assert.equal(await siteButton('이번달현장').count(), 0);
                await page.getByRole('button', { name: '이전 달', exact: true }).click();
                await page.getByText('선택한 달에 조건에 맞는 투입 현장이 없습니다.').waitFor();
                assert.equal(await page.getByRole('option', { name: '진행중 현장 (0)' }).count(), 1);
                if (mode === 'menu') {
                    await page.getByRole('button', { name: '검증용 메뉴 전환' }).click();
                    await siteButton('미출력현장').waitFor();
                    assert.equal(await page.getByRole('option', { name: '진행중 현장 (4)' }).count(), 1);
                    await page.getByRole('button', { name: '검증용 메뉴 전환' }).click();
                    await page.getByText('선택한 달에 조건에 맞는 투입 현장이 없습니다.').waitFor();
                }
                assert.deepEqual(errors, []);
                results.push({ width, mode, passed: true });
                await context.close();
            }
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
