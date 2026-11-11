// Real page components with synthetic services from client-mobile-preview only.
// Build first with scripts/client-mobile-preview.cjs. No live account is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const bundle = path.join(root, 'fixtures/client-mobile-preview/.build/preview.js');
const output = path.join(root, 'artifacts/advance-input-investigation');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await launch();
    const results = [];
    try {
        for (const width of [360, 390, 1366]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 768, isMobile: width < 768 });
            // Serve the local bundle in-memory and block all external requests.
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:4193') return route.abort();
                if (url.pathname === '/preview.js') return route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(bundle) });
                if (url.pathname !== '/') return route.abort();
                return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:4193/?preview=advance');
            const input = page.locator('input[inputmode=numeric]');
            await input.waitFor();
            await input.pressSequentially('123000');
            assert.equal(await input.inputValue(), '123000', 'Typing must preserve the input text');
            await input.evaluate(element => element.setSelectionRange(1, 1));
            await page.keyboard.type('45');
            assert.equal(await input.inputValue(), '14523000', 'Middle editing must retain the caret position');
            await input.press('Tab');
            assert.equal(await input.inputValue(), '14,523,000', 'Format after editing');

            await input.fill('');
            const client = await context.newCDPSession(page);
            await client.send('Input.imeSetComposition', { text: '１２３', selectionStart: 3, selectionEnd: 3 });
            assert.equal(await input.inputValue(), '１２３', 'IME composition must remain visible');
            await client.send('Input.insertText', { text: '１２３０００' });
            assert.equal(await input.inputValue(), '１２３０００', 'Committed full-width digits must remain visible');
            await input.press('Tab');
            assert.equal(await input.inputValue(), '123,000', 'Full-width digits must normalize to the same amount');
            await page.screenshot({ path: path.join(output, `after-${width}.png`), fullPage: true });

            const submit = page.getByRole('button', { name: width < 768 ? '가상작업자 가불 신청' : '가불 신청', exact: true });
            await submit.click();
            await page.getByText('가불 신청을 등록했습니다.', { exact: true }).waitFor();
            assert.equal(await input.inputValue(), '', 'Successful submission clears only the submitted draft');
            assert.deepEqual(errors, []);
            results.push({ width, typing: true, middleEdit: true, imeComposition: true, fullWidthAmount: true, submitWithSyntheticService: true });
            await context.close();
        }
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
