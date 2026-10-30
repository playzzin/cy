// Actual React pages with synthetic services; all external requests are blocked.
process.env.NODE_ENV = 'development';
const webpack = require('webpack');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.APPDATA, 'npm/node_modules/openclaw/node_modules/playwright-core'));
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/client-requirements-preview');
const output = path.join(root, 'artifacts/client-requirements-20261028');
fs.mkdirSync(output, { recursive: true });
const compiler = webpack({
    mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' }, resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [
        new webpack.NormalModuleReplacementPlugin(/(services[\\/](manpowerService|teamService|siteService|companyService|dailyReportService|dailyWorkerReportSiteService|teamResourceStatusService)|contexts[\\/](AuthContext|SiteModeContext)|routes[\\/]TeamWorkflowGate|hooks[\\/]useWorkerAccessScope)$/, path.join(fixture, 'mocks.ts')),
        new webpack.NormalModuleReplacementPlugin(/config[\\/]firebase$/, path.join(root, 'fixtures/team-resource-status-preview/firebase.ts')),
    ],
});
async function main() {
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve())));
    const css = await require('postcss')([require('tailwindcss')({ content: [path.join(root, 'src/pages/report/LaborCheckPage.tsx'), path.join(root, 'src/components/common/OutputManagementTabs.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    fs.writeFileSync(path.join(output, 'preview.css'), css.css);
    const server = http.createServer((req, res) => {
        const name = new URL(req.url, 'http://local').pathname.slice(1);
        if (/^[\w.-]+\.(js|css)$/.test(name) && fs.existsSync(path.join(output, name))) {
            res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : 'text/css'); fs.createReadStream(path.join(output, name)).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>고객 요구사항 검증</title><link rel="stylesheet" href="/preview.css"><body style="--header-height:56px;margin:0;padding:56px 0 64px;font-family:Arial,Malgun Gothic,sans-serif"><header style="position:fixed;top:0;height:56px;background:white;width:100%;z-index:50">가상 검증 화면</header><div id="root"></div><nav style="position:fixed;bottom:0;height:64px;background:white;width:100%;z-index:50">가상 하단 메뉴</nav><script src="/preview.js"></script></body></html>');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
        const page = await context.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/workers`);
        await page.getByRole('button', { name: /가상작업자 01.*검증팀/ }).waitFor();
        assert.match(await page.getByLabel('팀 재직 인원').innerText(), /14명/);
        assert.match(await page.getByLabel('재직자 서류 등록 현황').innerText(), /신분증 4명[\s\S]*서명 0명/);
        await page.screenshot({ path: path.join(output, 'worker-summary-mobile.png'), fullPage: false });
        await page.getByRole('textbox', { name: '작업자 빠른 검색', exact: true }).fill('가상작업자 0');
        const item = page.getByRole('button', { name: /가상작업자 08.*검증팀/ });
        await item.scrollIntoViewIfNeeded();
        const listY = await page.evaluate(() => window.scrollY);
        await item.click();
        const back = page.getByRole('button', { name: '작업자 목록으로', exact: true });
        await back.waitFor();
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const bounds = await back.boundingBox();
        assert.ok(bounds.y >= 56 && bounds.y + bounds.height <= 780, 'return button must stay above bottom navigation');
        await page.screenshot({ path: path.join(output, 'worker-detail-return-mobile.png'), fullPage: false });
        await page.goBack();
        await item.waitFor();
        await page.waitForFunction(y => Math.abs(window.scrollY - y) < 3, listY);
        assert.equal(await page.getByRole('textbox', { name: '작업자 빠른 검색', exact: true }).inputValue(), '가상작업자 0');
        await item.click(); await back.click(); await item.waitFor();
        await page.goto(`${origin}/history`);
        await page.getByRole('button', { name: /가상작업자 01.*검증팀/ }).click();
        await page.getByRole('region', { name: '근무내역 달력' }).waitFor();
        assert.equal(await page.getByRole('tab', { name: '목록보기' }).count(), 0);
        await page.getByRole('button', { name: /근무내역 1공수/ }).click();
        await page.getByRole('dialog').getByText('전체 이름을 확인하는 가상현장').waitFor();
        await page.screenshot({ path: path.join(output, 'work-history-detail-mobile.png'), fullPage: false });
        await page.getByRole('button', { name: '상세 닫기' }).click();
        await page.goto(`${origin}/labor?month=2026-09`);
        const former = page.getByText('기간검증 (퇴사)', { exact: true });
        await former.waitFor();
        const month = page.getByLabel('조회 월');
        for (const value of ['2026-07', '2026-08', '2026-09']) { await month.fill(value); await former.waitFor(); }
        await page.screenshot({ path: path.join(output, 'labor-period-mobile.png'), fullPage: false });
        for (const value of ['2026-06', '2026-10']) { await month.fill(value); await former.waitFor({ state: 'hidden' }); }
        await page.setViewportSize({ width: 1440, height: 900 });
        await month.fill('2026-08'); await former.waitFor();
        await page.screenshot({ path: path.join(output, 'labor-period-desktop.png'), fullPage: false });
        assert.deepEqual(errors, []);
        const result = { passed: true, requirements: [1, 3, 4, 5, 6], deferred: [2], viewports: [390, 1440], synthetic: true, externalWrites: 0, errors };
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
    } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
