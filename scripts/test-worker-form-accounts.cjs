// Run after: node scripts/worker-direct-pay-preview.cjs --build-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.APPDATA, 'npm/node_modules/openclaw/node_modules/playwright-core'));
const assets = path.resolve(__dirname, '../artifacts/worker-direct-pay-preview');
const output = path.resolve(__dirname, '../artifacts/worker-form-accounts');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const server = http.createServer((req, res) => {
        if (req.url === '/preview.js' || req.url === '/preview.css') {
            res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'text/css');
            fs.createReadStream(path.join(assets, req.url.slice(1))).pipe(res);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"><body><div id="root"></div><script src="/preview.js"></script></body></html>');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    try {
        for (const width of [1440, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/worker-form');
            await page.getByPlaceholder('이름 입력').fill('가상작업자');
            await page.getByPlaceholder('000000-0000000').fill('000000-0000000');
            for (const [label, value] of [
                ['기본 계좌 은행명', '기본은행'], ['기본 계좌 계좌번호', '0012345678'], ['기본 계좌 예금주', '타인명의'],
                ['직불용 계좌 은행명', '직불은행'], ['직불용 계좌 계좌번호', '0098765432'], ['직불용 계좌 예금주', '다른작업자'],
            ]) await page.getByLabel(label, { exact: true }).fill(value);
            assert.equal(await page.getByRole('button', { name: '등록 완료', exact: true }).isDisabled(), true);
            await page.getByRole('alert').filter({ hasText: '작업자 이름과 같아야' }).waitFor();
            await page.getByLabel('직불용 계좌 예금주', { exact: true }).fill('가상 작업자');
            await page.getByRole('group', { name: '기본 계좌 등록', exact: true }).scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `account-fields-${width}.png`), fullPage: true });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
            await page.getByRole('button', { name: '등록 완료', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            await page.reload();
            assert.equal(await page.getByLabel('기본 계좌 예금주', { exact: true }).inputValue(), '타인명의');
            assert.equal(await page.getByLabel('직불용 계좌 계좌번호', { exact: true }).inputValue(), '0098765432');
            await page.getByLabel('기본 계좌 계좌번호', { exact: true }).fill('000111222');
            await page.getByLabel('직불용 계좌 은행명', { exact: true }).fill('수정직불은행');
            await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            await page.reload();
            assert.equal(await page.getByLabel('기본 계좌 계좌번호', { exact: true }).inputValue(), '000111222');
            assert.equal(await page.getByLabel('직불용 계좌 은행명', { exact: true }).inputValue(), '수정직불은행');
            await page.getByPlaceholder('이름 입력').fill('새작업자');
            assert.equal(await page.getByRole('button', { name: '변경사항 저장', exact: true }).isDisabled(), true);
            await page.getByLabel('주민·외국인등록번호', { exact: true }).fill('000000-5000000');
            assert.equal(await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).isChecked(), true);
            assert.equal(await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).isDisabled(), true);
            await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            await page.reload();
            assert.equal(await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).isChecked(), true);
            await page.getByLabel('주민·외국인등록번호', { exact: true }).fill('000000-1000000');
            assert.equal(await page.getByRole('button', { name: '변경사항 저장', exact: true }).isDisabled(), true);
            await page.getByRole('button', { name: '취소', exact: true }).click();
            await page.getByPlaceholder('이름 입력').fill('SYNTHETIC WORKER');
            await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).check();
            assert.equal(await page.getByLabel('주민·외국인등록번호', { exact: true }).inputValue(), '');
            await page.getByLabel('직불용 계좌 은행명', { exact: true }).fill('외국인검증은행');
            await page.getByLabel('직불용 계좌 계좌번호', { exact: true }).fill('000999888');
            await page.getByLabel('직불용 계좌 예금주', { exact: true }).fill('다른예금주');
            await page.getByRole('button', { name: '등록 완료', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            await page.reload();
            assert.equal(await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).isChecked(), true);
            assert.equal(await page.getByLabel('직불용 계좌 예금주', { exact: true }).inputValue(), '다른예금주');
            await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `foreign-worker-${width}.png`), fullPage: true });
            await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).uncheck();
            assert.equal(await page.getByRole('button', { name: '변경사항 저장', exact: true }).isDisabled(), true);
            await page.getByRole('checkbox', { name: '외국인 작업자', exact: true }).check();
            await page.getByLabel('직불용 계좌 예금주', { exact: true }).fill('');
            assert.equal(await page.getByRole('button', { name: '변경사항 저장', exact: true }).isDisabled(), true);
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: 두 계좌 신규·수정·재조회, 외국인 자동 구분·번호 없는 직접 선택, 내국인 및 빈 예금주 검증`);
            await context.close();
        }
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
