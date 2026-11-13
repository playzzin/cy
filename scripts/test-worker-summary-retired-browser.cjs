// Real summary UI, synthetic documents, and no external network requests.
process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/worker-summary-retired');
const origin = 'http://127.0.0.1:4196';
fs.mkdirSync(output, { recursive: true });
const modulePath = file => JSON.stringify(path.join(root, file).replace(/\\/g, '/'));
fs.writeFileSync(path.join(output, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from ${modulePath('src/pages/manpower/WorkerSummaryPage')};
createRoot(document.getElementById('root')!).render(<Page />);
`);
fs.writeFileSync(path.join(output, 'services.ts'), `
export * from ${modulePath('fixtures/worker-direct-pay-preview/services')};
export const supportTeamDocumentService = {
 list: async () => [],
 read: async (id: string, kind: string, name: string, signal: AbortSignal, includeRetired: boolean) => {
  if (id !== 'retired' || !includeRetired) throw new Error('Unexpected document scope');
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), char => char.charCodeAt(0));
  return new File([bytes], name + '.png', {type: 'image/png'});
 }
};
`);
async function main() {
    const compiler = webpack({
        mode: 'development', devtool: false, context: root, entry: path.join(output, 'entry.tsx'),
        output: { path: output, filename: 'preview.js', publicPath: '/' },
        resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
        ] },
        plugins: [new webpack.NormalModuleReplacementPlugin(/(services\/(manpowerService|teamService|companyService|workerBankPhotoService|supportTeamDocumentService|aiSettingsService|geminiService|geminiGatewayClient|identityDocumentLogService|teamScopedReadService)|\.\/geminiGatewayClient|contexts\/AuthContext|routes\/TeamWorkflowGate|config\/firebase)$/, path.join(output, 'services.ts'))],
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve())));
    const css = await require('postcss')([require('tailwindcss')({ content: [path.join(root, 'src/pages/manpower/WorkerSummaryPage.tsx')] })])
        .process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><body><div id="root"></div><script src="/preview.js"></script></body></html>`;
    const browser = await chromium.launch({ headless: true });
    const results = [];
    try {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            const errors = [];
            await context.route('**/*', route => {
                if (!route.request().url().startsWith(origin + '/')) return route.abort();
                return route.fulfill(route.request().url().endsWith('/preview.js')
                    ? { contentType: 'application/javascript', body: fs.readFileSync(path.join(output, 'preview.js')) }
                    : { contentType: 'text/html', body: html });
            });
            await context.addInitScript(() => localStorage.setItem('worker-direct-pay-preview', JSON.stringify([
                { id: 'active', name: '가상재직자', teamId: 'test-team', status: '재직' },
                { id: 'retired', name: '가상퇴사자', teamId: 'test-team', status: '퇴사', fileNameSaved: 'id_cards/synthetic.png', directPayBankPhotoId: 'synthetic' },
                { id: 'blocked', name: '가상출입금지', teamId: 'test-team', status: '출입금지', isActive: false },
            ])));
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/');
            await page.getByRole('checkbox', { name: '가상재직자 선택' }).waitFor();
            assert.equal(await page.getByRole('checkbox', { name: '가상퇴사자 선택' }).count(), 0);
            await page.getByRole('checkbox', { name: '퇴사자 포함' }).check();
            assert.equal(await page.getByRole('checkbox', { name: '가상출입금지 선택' }).count(), 0);
            await page.getByRole('searchbox').fill('퇴사');
            await page.getByRole('checkbox', { name: /목록 전체 선택/ }).check();
            await page.screenshot({ path: path.join(output, `${viewport.width}-select.png`), fullPage: true });
            if (viewport.width < 769) await page.getByRole('button', { name: '요약 보기', exact: true }).click();
            for (const label of ['신분증', '직불용 통장사본']) {
                await page.getByRole('button', { name: `${label} 공유`, exact: true }).click();
                await page.getByAltText(`가상퇴사자 ${label} 공유 미리보기`).waitFor();
                await page.getByRole('button', { name: `${label} 공유 닫기`, exact: true }).click();
            }
            await page.screenshot({ path: path.join(output, `${viewport.width}-summary.png`), fullPage: true });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if (viewport.width < 769) await page.getByRole('button', { name: '작업자 선택', exact: true }).click();
            await page.getByRole('checkbox', { name: '퇴사자 포함' }).uncheck();
            assert.equal(await page.getByRole('checkbox', { name: '가상퇴사자 선택' }).count(), 0);
            assert.match(await page.locator('.ws-selection-count').textContent(), /0\s*명 선택/);
            assert.deepEqual(errors, []);
            results.push({ viewport, passed: true });
            await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, synthetic: true, externalWrites: 0, results }, null, 2));
    console.log(JSON.stringify(results));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
