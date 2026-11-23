// Real page and original viewers, synthetic data only; no production requests.
process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { PDFDocument } = require('pdf-lib');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/team-originals-preview');
const output = path.join(root, 'artifacts/team-originals-preview');
const origin = 'http://127.0.0.1:4199';

async function build() {
    const replacements = ['services/accommodationService', 'services/cardService', 'services/vehicleService', 'services/manpowerService',
        'hooks/useWorkerAccessScope', 'hooks/useExpenseLedgerData', 'services/cardStatementAttachmentService',
        'services/vehicleFineImportService', 'utils/devAdminSession', 'utils/swal'];
    const compiler = webpack({
        mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
        output: { path: output, filename: 'preview.js', publicPath: '/' },
        resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
                presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
            } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
        ] },
        plugins: replacements.map(name => new webpack.NormalModuleReplacementPlugin(new RegExp(name.replace('/', '[\\\\/]') + '$'), path.join(fixture, 'mocks.ts'))),
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
        if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only'))); else resolve();
    })));
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    await build();
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Synthetic original - browser verification only', { x: 40, y: 750, size: 16 });
    const pdfBytes = Buffer.from(await pdf.save());
    const browser = await launch();
    const results = [];
    try {
        for (const width of [390, 1366]) {
            const height = width === 390 ? 844 : 900;
            const context = await browser.newContext({ viewport: { width, height } });
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) return route.abort();
                if (url.pathname === '/preview.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(output, 'preview.js')) });
                if (url.pathname === '/fixture.pdf') return route.fulfill({ contentType: 'application/pdf', body: pdfBytes });
                return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;background:#f1f5f9}button,input,select{font:inherit}*{box-sizing:border-box}</style><div id="root"></div><script src="/preview.js"></script></html>' });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(`${origin}/support/team-resource-detail`);
            await page.getByRole('tab', { name: /^카드/ }).click();
            const shortcut = page.getByRole('region', { name: '카드 원본 빠른보기' });
            await shortcut.getByRole('button', { name: '검증카드 카드 원본 보기' }).click();
            const dialog = page.getByRole('dialog');
            await dialog.getByRole('img').waitFor();
            const fit = await dialog.getByRole('img').boundingBox();
            const canvas = await dialog.getByRole('region', { name: '원본 미리보기' }).boundingBox();
            assert.ok(canvas.height > height * .4, '미리보기는 화면 높이의 40% 이상이어야 합니다');
            await dialog.getByRole('button', { name: '확대', exact: true }).click();
            const zoomed = await dialog.getByRole('img').boundingBox();
            assert.ok(zoomed.width > fit.width * 1.4 && zoomed.height > fit.height * 1.4, '실제 원본 크기가 확대되어야 합니다');
            await dialog.getByRole('button', { name: '화면에 맞추기' }).click();
            assert.equal(await dialog.getByLabel('확대 배율').innerText(), '100%');
            await page.screenshot({ path: path.join(output, `card-${width}.png`) });
            await dialog.getByRole('button', { name: '이전 원본' }).click();
            assert.equal(await dialog.getByLabel('확대 배율').innerText(), '100%');
            await dialog.getByRole('button', { name: '이전 원본' }).click();
            await dialog.getByTitle('사용내역서.pdf PDF 원본').waitFor();
            assert.equal(await dialog.getByRole('button', { name: '이전 원본' }).isDisabled(), true);
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(await shortcut.getByRole('button').evaluate(button => document.activeElement === button), true, '닫으면 원본 버튼으로 초점 복귀');
            await page.getByRole('tab', { name: /^차량/ }).click();
            await page.getByRole('region', { name: '과태료 원본 빠른보기' }).getByRole('button', { name: '12가3456 과태료 원본 보기' }).click();
            await dialog.getByAltText('과태료 고지서 원본').waitFor();
            const closeBounds = await dialog.getByRole('button', { name: '닫기', exact: true }).boundingBox();
            assert.ok(closeBounds && closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= width && closeBounds.y >= 0 && closeBounds.y + closeBounds.height < height, '고지서 닫기 버튼이 잘리지 않아야 합니다');
            assert.match(await dialog.getByLabel('선택한 과태료 정보').innerText(), /32,000원/);
            await page.screenshot({ path: path.join(output, `fine-${width}.png`) });
            await dialog.getByRole('button', { name: '다음 고지서' }).click();
            await dialog.getByTitle('과태료 PDF 원본').waitFor();
            assert.match(await dialog.getByLabel('선택한 과태료 정보').innerText(), /64,000원/);
            const bounds = await dialog.boundingBox();
            assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, '원본 창이 화면 안에 들어가야 합니다');
            assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, '원본 창 가로 넘침 없음');
            await dialog.getByRole('button', { name: '닫기', exact: true }).click();
            await dialog.waitFor({ state: 'hidden' });
            assert.deepEqual(errors, []);
            results.push({ width, passed: true });
            await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
