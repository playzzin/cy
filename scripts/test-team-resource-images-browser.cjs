// Real screens, synthetic originals and stored detail responses; no production traffic.
process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const { PDFDocument, rgb } = require('pdf-lib');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/team-resource-images-preview');
const output = path.join(root, 'artifacts/team-resource-images/browser');
const origin = 'http://127.0.0.1:4212';
async function assertStablePdf(page) {
    await page.locator('.original-pdf__page[aria-busy="false"] canvas:not([hidden])').waitFor();
    const stability = await page.locator('.original-pdf__page').evaluate(async host => {
        const original = host.querySelector('canvas');
        const width = host.clientWidth;
        let replacements = 0, hiddenFrames = 0, widthChanges = 0;
        for (let frame = 0; frame < 120; frame++) {
            await new Promise(requestAnimationFrame);
            if (host.querySelector('canvas') !== original) replacements++;
            if (original.hidden || !original.isConnected) hiddenFrames++;
            if (host.clientWidth !== width) widthChanges++;
        }
        return { replacements, hiddenFrames, widthChanges };
    });
    assert.deepEqual(stability, { replacements: 0, hiddenFrames: 0, widthChanges: 0 }, 'PDF remains visible without scrollbar/render feedback');
}
async function build() {
    const replacements = ['services/accommodationService', 'services/cardService', 'services/vehicleService', 'services/manpowerService',
        'hooks/useWorkerAccessScope', 'hooks/useExpenseLedgerData', 'services/cardStatementAttachmentService', 'services/cardStatementImportService',
        'services/vehicleFineImportService', 'utils/devAdminSession', 'utils/swal'];
    const compiler = webpack({ mode: 'development', devtool: false, cache: false, context: root,
        entry: path.join(fixture, 'index.tsx'), output: { path: output, filename: 'preview.js', publicPath: '/' },
        resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
            { test: /\.(woff2?|ttf|otf)$/, type: 'asset/resource' },
        ] },
        plugins: replacements.map(module => new webpack.NormalModuleReplacementPlugin(new RegExp(module.replaceAll('/', '[\\\\/]') + '$'), path.join(fixture, 'mocks.ts'))),
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
        if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only'))); else resolve();
    })));
    console.log('Compiled original image preview');
}
(async () => {
    fs.mkdirSync(output, { recursive: true });
    if (!process.argv.includes('--skip-build')) await build();
    const pdf = await PDFDocument.create();
    const paper = pdf.addPage([600, 800]);
    paper.drawRectangle({ x: 30, y: 660, width: 540, height: 100, color: rgb(.12, .25, .5) });
    paper.drawText('SYNTHETIC CARD STATEMENT', { x: 50, y: 720, size: 23, color: rgb(1, 1, 1) });
    for (let index = 0; index < 8; index++) paper.drawText(`2026-11-${String(index + 1).padStart(2, '0')}   SAMPLE MERCHANT       18,000`, { x: 50, y: 610 - index * 55, size: 15 });
    pdf.addPage([600, 800]).drawText('SYNTHETIC SECOND PAGE', { x: 50, y: 700, size: 24 });
    const pdfBytes = Buffer.from(await pdf.save());
    const browser = await launch();
    const results = [];
    try {
        for (const width of [390, 360, 430, 768, 1024, 1366]) {
            const context = await browser.newContext({ viewport: { width, height: 844 } });
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) return route.abort();
                if (url.pathname === '/fixture.pdf') return route.fulfill({ contentType: 'application/pdf', body: pdfBytes });
                const local = path.resolve(output, `.${decodeURIComponent(url.pathname)}`);
                if (local.startsWith(output + path.sep) && fs.existsSync(local) && fs.statSync(local).isFile()) {
                    return route.fulfill({ path: local, contentType: /\.m?js$/.test(local) ? 'application/javascript' : local.endsWith('.wasm') ? 'application/wasm' : undefined });
                }
                return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;background:#f1f5f9}button,input,select{font:inherit}*{box-sizing:border-box}</style><div id="root"></div><script src="/preview.js"></script></html>' });
            });
            const page = await context.newPage();
            page.setDefaultTimeout(20000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            try {
                await page.goto(`${origin}/support/team-resource-detail`);
                // Exercise scrollbars that consume layout width, even in headless Chrome.
                await page.addStyleTag({ content: '.original-pdf__page::-webkit-scrollbar { width: 16px; height: 16px; }' });
                await page.evaluate(() => document.fonts.ready);
                for (const label of ['종합', '숙소', '차량', '카드', '경비']) {
                    await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click();
                    const layout = await page.locator('.trd-page').evaluate(root => {
                        const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
                        const tabs = [...root.querySelectorAll('[role="tablist"]')].filter(el => visible(el) && el.querySelectorAll('[role="tab"]').length === 5);
                        const overflowing = [...root.querySelectorAll('*')].filter(el => visible(el) && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1);
                        const clippedCells = [...root.querySelectorAll('.trd-ledger-table td')].filter(el => visible(el) && el.scrollWidth > el.clientWidth + 1);
                        return { allTabsFit: tabs.length > 0 && tabs.every(el => el.scrollWidth <= el.clientWidth + 1 && [...el.children].every(child => child.getBoundingClientRect().right <= innerWidth)), horizontalScrollers: overflowing.map(el => el.className), clippedCells: clippedCells.map(el => el.dataset.label), pageFits: document.documentElement.scrollWidth <= innerWidth + 1 };
                    });
                    assert.equal(layout.allTabsFit, true, `${width}px ${label}: all five tabs fit`);
                    assert.deepEqual(layout.horizontalScrollers, [], `${width}px ${label}: no horizontal content scrolling`);
                    assert.deepEqual(layout.clippedCells, [], `${width}px ${label}: long values wrap instead of clipping`);
                    assert.equal(layout.pageFits, true, `${width}px ${label}: page fits`);
                }
                if (width === 390) await page.locator('.trd-mobile-detail-tabs').screenshot({ path: path.join(output, 'tabs-390.png') });
                await page.getByRole('tab', { name: /^카드/ }).click();
                const cards = page.getByRole('region', { name: '카드 원본 빠른보기' });
                await cards.scrollIntoViewIfNeeded();
                const thumbnail = cards.getByRole('img', { name: '사용내역서.pdf PDF 첫 페이지' });
                await thumbnail.waitFor();
                assert.ok(await thumbnail.evaluate(canvas => {
                    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                    return canvas.width > 100 && data.some((value, index) => index % 4 !== 3 && value < 150);
                }), 'PDF thumbnail must contain actual rendered page pixels');
                await cards.locator('.original-thumbnail img').first().waitFor();
                await page.evaluate(() => document.fonts.ready);
                if (width === 390 || width === 1366) await page.screenshot({ path: path.join(output, `card-gallery-${width}.png`) });
                await cards.getByRole('button', { name: '검증카드 사용내역서.pdf 원본 보기', exact: true }).click();
                await page.getByTitle('사용내역서.pdf PDF 원본').waitFor();
                const pdfPage = page.getByRole('img', { name: '사용내역서.pdf PDF 원본 1쪽', exact: true });
                await pdfPage.waitFor();
                await assertStablePdf(page);
                assert.ok(await pdfPage.evaluate(canvas => canvas.width > 100 && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 !== 3 && v < 150)));
                const fittedWidth = (await pdfPage.boundingBox()).width;
                await page.getByRole('button', { name: 'PDF 확대', exact: true }).click();
                await page.waitForFunction(width => document.querySelector('.original-pdf canvas:not([hidden])')?.getBoundingClientRect().width > width * 1.4, fittedWidth);
                await assertStablePdf(page);
                await page.getByRole('button', { name: 'PDF 다음 페이지', exact: true }).click();
                await page.getByRole('img', { name: '사용내역서.pdf PDF 원본 2쪽', exact: true }).waitFor();
                assert.match(await page.getByLabel('PDF 페이지', { exact: true }).innerText(), /2 \/ 2/);
                await page.keyboard.press('Escape');
                await page.getByRole('dialog').waitFor({ state: 'hidden' });
                const detail = cards.locator('.team-card-usage--inline');
                await detail.getByText('가상 주유소', { exact: true }).waitFor();
                assert.equal(await detail.locator('.team-card-usage__rows article').count(), 3);
                assert.equal(await page.getByRole('dialog').count(), 0, 'Details appear without a lookup dialog');
                await detail.getByRole('button', { name: '전체 4건 펼치기', exact: true }).click();
                await detail.getByText('가상 현장 식당', { exact: true }).waitFor();
                assert.equal(await detail.getByText('다른 카드 내역').count(), 0);
                assert.match(await detail.locator('.team-card-usage__summary').innerText(), /4건.*40,000원/s);
                await detail.getByLabel('카드 상세내역 검색').fill('주유소');
                assert.equal(await detail.getByText('가상 현장 식당', { exact: true }).count(), 0);
                await detail.getByLabel('카드 상세내역 검색').fill('');
                if (width === 390 || width === 1366) await page.screenshot({ path: path.join(output, `card-details-${width}.png`) });
                const bounds = await detail.boundingBox();
                assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
                assert.equal(await detail.locator('.team-card-usage__rows button').count(), 0, 'Usage rows contain details only');
                await cards.locator('.trd-card-original__photos button').first().click();
                await page.getByTitle('사용내역서.pdf PDF 원본').waitFor();
                await page.getByRole('button', { name: '청구서 파일 닫기', exact: true }).click();
                await detail.waitFor();
                await detail.getByRole('button', { name: '간단히 보기', exact: true }).click();
                assert.equal(await detail.locator('.team-card-usage__rows article').count(), 3);
                await page.getByRole('tab', { name: /^차량/ }).click();
                const fines = page.getByRole('region', { name: '과태료 원본 빠른보기' });
                await fines.scrollIntoViewIfNeeded();
                await fines.locator('.original-thumbnail img').waitFor();
                await fines.locator('.original-thumbnail canvas').waitFor();
                assert.match(await fines.innerText(), /납부기한.*28/s);
                if (width === 390 || width === 1366) await page.screenshot({ path: path.join(output, `fine-gallery-${width}.png`) });
                const second = fines.locator('.fine-photo-card').nth(1);
                await second.click();
                await page.getByTitle('과태료 PDF 원본').waitFor();
                await page.getByRole('img', { name: '과태료 PDF 원본 1쪽', exact: true }).waitFor();
                await assertStablePdf(page);
                assert.match(await page.getByLabel('선택한 과태료 정보').innerText(), /64,000원/);
                await page.getByRole('button', { name: '닫기', exact: true }).click();
                assert.equal(await second.evaluate(node => node === document.activeElement), true);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
                assert.deepEqual(errors, []);
                results.push({ width, passed: true, pdfRendered: true, cardDetails: true, fineSelection: true });
                console.log(`Passed ${width}px`);
            } catch (error) {
                await page.screenshot({ path: path.join(output, `failure-${width}.png`), fullPage: true });
                results.push({ width, failure: error.message, errors, body: (await page.locator('body').innerText()).slice(-4000) });
                throw error;
            } finally {
                fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
                await context.close();
            }
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
