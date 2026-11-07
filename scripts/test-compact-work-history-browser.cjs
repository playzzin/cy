// Render the real page with synthetic attendance and block all external requests.
process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/compact-work-history');
const origin = 'http://127.0.0.1:4197';
const syntheticMocks = path.join(root, 'fixtures/client-requirements-preview/mocks.ts');
fs.mkdirSync(output, { recursive: true });
const modulePath = file => JSON.stringify(path.join(root, file).replace(/\\/g, '/'));
fs.writeFileSync(path.join(output, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import Page from ${modulePath('src/pages/manpower/TeamWorkerDetailPage')};
import WorkerWorkHistory from ${modulePath('src/components/manpower/WorkerWorkHistory')};
createRoot(document.getElementById('root')!).render(<BrowserRouter>{location.pathname === '/site'
 ? <WorkerWorkHistory siteName="가상현장" month="2026-03" rows={[]} loading={false} error="" />
 : <Page view="workHistory" />}</BrowserRouter>);
`);
fs.writeFileSync(path.join(output, 'attendance.ts'), `
export const dailyReportService = {
 getWorkerRows: async ({startDate, endDate}: {startDate: string; endDate: string}) => Array.from({length: Number(endDate.slice(-2))}, (_, i) => ({
  reportId: 'qa-' + i, workerId: 'qa-0', workerName: '가상작업자 01', teamId: 'qa-team', teamName: '검증팀',
  date: startDate.slice(0, 8) + String(i + 1).padStart(2, '0'), manDay: i === 0 ? 0.25 : i % 3 === 0 ? 0.5 : 1,
  unitPrice: 100000, siteName: '전체 이름을 확인하는 아주 긴 가상현장 ' + (i + 1)
 })),
 getReportWorkerRowsByRange: async () => [],
};
`);
const compiler = webpack({
    mode: 'development', devtool: false, context: root, entry: path.join(output, 'entry.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
        { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
        { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
    ] },
    plugins: [
        new webpack.NormalModuleReplacementPlugin(/(services[\\/](manpowerService|teamService|siteService|companyService|teamResourceStatusService)|contexts[\\/](AuthContext|SiteModeContext)|routes[\\/]TeamWorkflowGate|hooks[\\/]useWorkerAccessScope)$/, syntheticMocks),
        new webpack.NormalModuleReplacementPlugin(/services[\\/]dailyReportService$/, path.join(output, 'attendance.ts')),
        new webpack.NormalModuleReplacementPlugin(/config[\\/]firebase$/, path.join(root, 'fixtures/team-resource-status-preview/firebase.ts')),
    ],
});

async function main() {
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() =>
        error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve())));
    const css = await require('postcss')([require('tailwindcss')({ content: [path.join(root, 'src/components/common/MonthNavigator.tsx')] })])
        .process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>${css.css} body{--header-height:56px;margin:0;padding:56px 0 64px;font-family:Arial,'Malgun Gothic',sans-serif;background:#f1f5f9}
      #app-header, #bottom-nav{position:fixed;left:0;right:0;background:white;z-index:50;display:flex;align-items:center;padding:0 16px;font-size:12px;color:#475569}
      #app-header{top:0;height:56px;border-bottom:1px solid #e2e8f0}#bottom-nav{bottom:0;height:64px;border-top:1px solid #e2e8f0}
      </style><header id="app-header">팀장 · 인원관리</header><div id="root"></div><nav id="bottom-nav">합성 자료 검증</nav><script src="/preview.js"></script></html>`;
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const results = [];
    try {
        for (const viewport of [{width:360,height:640}, {width:390,height:700}, {width:390,height:844}, {width:430,height:932}, {width:768,height:900}, {width:1440,height:900}]) {
            const context = await browser.newContext({ viewport });
            const errors = [];
            await context.route('**/*', route => {
                const url = route.request().url();
                if (!url.startsWith(origin + '/')) return route.abort();
                return url.endsWith('/preview.js')
                    ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(output, 'preview.js')) })
                    : route.fulfill({ contentType: 'text/html', body: html });
            });
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            for (const month of ['2027-02', '2026-10', '2026-03']) {
                await page.clock.setFixedTime(new Date(`${month}-15T12:00:00`));
                await page.goto(origin + '/history');
                await page.getByRole('button', { name: /가상작업자 01.*검증팀/ }).click();
                const calendar = page.locator('.worker-history__calendar');
                const firstDay = page.getByRole('button', { name: `${month}-01 근무내역 0.25공수` });
                await firstDay.waitFor();
                const bounds = await calendar.boundingBox();
                await page.screenshot({path: path.join(output, `${viewport.width}x${viewport.height}-${month}.png`), fullPage: false});
                const back = page.getByRole('button', { name: '작업자 목록으로', exact: true });
                const lastDay = new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate();
                assert.equal(await calendar.getByRole('button').count(), lastDay);
                const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
                    overflow: [...document.querySelectorAll('.worker-history__day-total')].some(el => el.scrollWidth > el.clientWidth) }));
                assert.ok(layout.scrollWidth <= layout.width, 'no horizontal page overflow');
                assert.equal(layout.overflow, false, 'fractional man-days remain readable');
                if (viewport.width <= 768) {
                    const backBounds = await back.boundingBox();
                    const hero = await page.locator('.tw-worker-hero').boundingBox();
                    assert.ok(hero.y >= 56, 'worker identity stays below the fixed header');
                    assert.ok(bounds.y >= 56 && bounds.y + bounds.height <= backBounds.y, `whole ${month} calendar fits above return button at ${viewport.width}x${viewport.height}: ${JSON.stringify({bounds,backBounds})}`);
                }
                await firstDay.click();
                const dialog = page.getByRole('dialog');
                await dialog.getByText('전체 이름을 확인하는 아주 긴 가상현장 1', {exact:true}).waitFor();
                await dialog.getByText('0.25공수', {exact:true}).waitFor();
                await dialog.getByText('25,000원', {exact:true}).waitFor();
                await page.getByRole('button', {name:'상세 닫기'}).click();
                if (viewport.width <= 768) {
                    await back.click();
                    await page.getByRole('button', {name:/가상작업자 01.*검증팀/}).waitFor();
                }
                results.push({ viewport, month, calendarHeight: bounds.height, passed: true });
            }
            await page.goto(origin + '/site');
            await page.getByRole('tab', {name:'목록보기'}).waitFor();
            assert.equal(await page.locator('.worker-history--personal').count(), 0);
            assert.deepEqual(errors, []);
            await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({passed:true, synthetic:true, externalWrites:0, results}, null, 2));
    console.log(JSON.stringify(results));
}
main().catch(error => {console.error(error); process.exitCode=1;});
