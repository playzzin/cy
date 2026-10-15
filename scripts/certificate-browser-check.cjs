// Pass an installed Playwright module path as argv[2] when it is not a project dependency.
const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../output/certificate-preview');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const results = [];
    try {
        for (const route of ['certificate', 'termination-certificate']) {
            const page = await browser.newPage();
            // Serve the compiled fixture in-process, including in network-isolated QA hosts.
            await page.route('http://127.0.0.1:4193/**', async routeRequest => {
                const pathname = new URL(routeRequest.request().url()).pathname;
                const local = path.resolve(output, `.${pathname}`);
                if (pathname.endsWith('.js') && local.startsWith(`${output}${path.sep}`) && fs.existsSync(local)) {
                    await routeRequest.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(local) });
                } else {
                    await routeRequest.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>증명서 모바일 검증</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,input,select{font:inherit}</style><div id="root"></div><script src="/preview.js"></script></html>' });
                }
            });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                window.sharedCertificates = [];
                Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
                Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
                    window.sharedCertificates.push({ name: data.files[0].name, size: data.files[0].size, activated: navigator.userActivation.isActive, url: data.url });
                } });
            });
            for (const width of [320, 390, 768, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                await page.goto(`http://127.0.0.1:4193/hr/${route}`);
                await page.getByText('가상근로자 (주민번호 미등록)').click();
                if (width <= 1024) await page.getByRole('button', { name: '미리보기 · 공유' }).click();
                await page.waitForFunction(() => {
                    const paper = document.querySelector('.certificate-preview__paper');
                    const viewport = document.querySelector('.certificate-preview__viewport');
                    return paper.getBoundingClientRect().width <= viewport.clientWidth - 23;
                });
                const fit = await page.evaluate(() => ({
                    documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
                    paperWidth: document.querySelector('.certificate-preview__paper').getBoundingClientRect().width,
                    panelWidth: document.querySelector('.certificate-preview__viewport').clientWidth,
                }));
                assert.ok(fit.documentWidth <= width + 1, `${route} ${width}: horizontal page overflow`);
                await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
                await page.getByRole('button', { name: '원본 크기' }).click();
                const zoom = await page.locator('.certificate-preview__viewport').evaluate(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth, pageWidth: document.documentElement.scrollWidth }));
                assert.ok(zoom.pageWidth <= width + 1, 'zoom must scroll within preview');
                await page.getByRole('button', { name: '화면에 맞추기' }).click();
                if (width === 390) {
                    await page.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' }).click();
                    await page.getByRole('button', { name: '이미지 저장' }).waitFor({ timeout: 30000 });
                    const image = page.getByAltText('공유할 증명서 이미지');
                    const dimensions = await image.evaluate(async e => {
                        await e.decode();
                        return { width: e.naturalWidth, height: e.naturalHeight, bytes: await (await fetch(e.src)).arrayBuffer().then(b => Array.from(new Uint8Array(b))) };
                    });
                    assert.ok(dimensions.width >= 1580 && dimensions.height >= 2240, 'full-resolution A4 image');
                    fs.writeFileSync(path.join(output, `${route}-export.png`), Buffer.from(dimensions.bytes));
                    await page.getByRole('button', { name: '카카오톡 공유', exact: true }).click();
                    const shared = await page.evaluate(() => window.sharedCertificates);
                    assert.equal(shared.length, 1);
                    assert.equal(shared[0].activated, true);
                    assert.equal(shared[0].url, undefined);
                    await page.getByRole('button', { name: '발급 설정', exact: true }).click();
                    await page.getByRole('combobox', { name: '도장 인쇄' }).selectOption('exclude');
                    await page.getByRole('button', { name: '미리보기 · 공유' }).click();
                    assert.equal(await page.getByAltText('공유할 증명서 이미지').count(), 0);
                    results.push({ route, export: { width: dimensions.width, height: dimensions.height }, shareActivation: shared[0].activated });
                }
                results.push({ route, width, ...fit });
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
