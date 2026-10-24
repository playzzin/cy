const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const bundle = path.join(root, 'fixtures/client-mobile-preview/.build');
const output = path.join(root, 'artifacts/client-mobile-workflow');
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const results = [];
    try {
        for (const width of [360, 390, 430, 1366]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('http://127.0.0.1:4193/**', async route => {
                const pathname = new URL(route.request().url()).pathname;
                const local = path.resolve(bundle, `.${pathname}`);
                if (pathname.endsWith('.js') && local.startsWith(`${bundle}${path.sep}`) && fs.existsSync(local)) {
                    await route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(local) });
                } else {
                    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
                }
            });
            await page.goto('http://127.0.0.1:4193');
            await page.getByRole('button', { name: /가상작업자.*검증팀/ }).click();
            await page.getByRole('tab', { name: '근무내역', exact: true }).click();
            assert.equal(await page.getByRole('group', { name: '조회월' }).isVisible(), true);
            assert.equal(await page.getByRole('group', { name: '작업자 상태' }).isVisible(), true);
            const day = page.getByRole('button', { name: /근무내역 1.5공수/ });
            await day.click();
            const dialog = page.getByRole('dialog');
            await dialog.getByText('아주 긴 이름의 첫 번째 가상 검증 현장').waitFor();
            await dialog.getByText('두 번째 가상 현장').waitFor();
            assert.ok(await dialog.evaluate(element => element.getBoundingClientRect().width <= innerWidth));
            await page.screenshot({ path: path.join(output, `worker-detail-${width}.png`), fullPage: true });
            await dialog.getByRole('button', { name: '상세 닫기' }).click();
            await page.getByRole('tab', { name: '목록보기' }).click();
            await page.getByRole('button', { name: /근무 상세/ }).waitFor();
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            assert.equal(overflow, false, `horizontal overflow at ${width}`);
            await page.screenshot({ path: path.join(output, `worker-list-${width}.png`), fullPage: true });
            assert.deepEqual(errors, []);
            results.push({ width, monthAndStatusVisible: true, twoSitesInDialog: true, compactList: true, horizontalOverflow: overflow });
            await page.getByRole('button', { name: /근무 상세/ }).click();
            if (width <= 640) { await page.goBack(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
            else await page.keyboard.press('Escape');
            for (const view of ['board', 'advance', 'approval', 'settlement', 'photo']) {
                await page.goto(`http://127.0.0.1:4193/?preview=${view}`);
                if (view === 'board') {
                    await page.getByRole('heading', { name: '아주 긴 이름의 첫 번째 가상 검증 현장' }).waitFor();
                    const cards = page.locator('.whiteboard-site-card');
                    assert.equal(await cards.count(), 2);
                    await page.waitForTimeout(450);
                    if (width <= 640) {
                        const a = await cards.nth(0).boundingBox(), b = await cards.nth(1).boundingBox();
                        assert.ok(Math.abs(a.y - b.y) < 3 && b.x > a.x, 'two mobile card columns');
                    }
                    await page.screenshot({ path: path.join(output, `board-collapsed-${width}.png`), fullPage: true });
                    await cards.first().click();
                    // The component's reveal/layout transition is 280ms; inspect its settled layout.
                    await page.waitForTimeout(450);
                    const expanded = await page.locator('.whiteboard-site-card[data-expanded=true]').boundingBox();
                    const grid = await page.locator('.whiteboard-site-grid').boundingBox();
                    assert.ok(expanded.width >= grid.width - 3, 'expanded card spans the grid');
                    assert.equal(await page.getByRole('button', { name: '일보목록' }).count(), 0);
                }
                if (view === 'advance') {
                    const amount = page.getByRole('textbox', { name: '신청 금액 원' });
                    await amount.waitFor();
                    assert.equal(await page.locator('.advance-calculation-details').getAttribute('open'), null);
                    assert.equal(await page.locator('.advance-work-details').getAttribute('open'), null);
                    await amount.fill('10000');
                    fs.writeFileSync(path.join(output, 'advance-synthetic-debug.txt'), await page.locator('body').innerText());
                    await page.screenshot({ path: path.join(output, `advance-${width}.png`), fullPage: true });
                    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '가불 신청' && !button.disabled));
                }
                if (view === 'approval') {
                    await page.getByText('합성작업자 1', { exact: true }).waitFor();
                    await page.getByRole('button', { name: '표시된 목록 선택 (최대 20건)' }).click();
                    await page.getByRole('button', { name: '선택 3건 승인·갱신' }).click();
                    await page.getByRole('dialog').getByRole('button', { name: '확인 후 승인·갱신' }).click();
                    await page.getByText('합성작업자 1: 승인 완료', { exact: true }).waitFor();
                }
                if (view === 'settlement') {
                    await page.getByRole('button', { name: '이전 달' }).click();
                    fs.writeFileSync(path.join(output, 'settlement-synthetic-debug.txt'), await page.locator('body').innerText());
                    await page.screenshot({ path: path.join(output, `settlement-${width}.png`), fullPage: true });
                    await page.getByText('2025년 12월', { exact: true }).first().waitFor();
                    await page.evaluate(() => window.scrollTo(0, 800));
                    const bar = await page.locator('.team-settlement-page__workspace-bar').boundingBox();
                    assert.ok(bar.y >= 0 && bar.y < 100, `sticky settlement month at ${width}: ${bar.y}`);
                }
                if (view === 'photo') {
                    await page.getByRole('button', { name: '사진 공유·저장' }).click();
                    await page.getByRole('button', { name: '사진 저장' }).waitFor();
                    assert.equal(await page.getByRole('img', { name: '공유할 사진' }).isVisible(), true);
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${view} overflow at ${width}`);
                assert.deepEqual(errors, [], `${view} page errors at ${width}`);
                await page.screenshot({ path: path.join(output, `${view}-${width}.png`), fullPage: view !== 'settlement' });
                results.push({ width, view, horizontalOverflow: false, passed: true });
            }
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
