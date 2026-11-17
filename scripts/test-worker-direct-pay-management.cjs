// Run after: node scripts/worker-direct-pay-preview.cjs --build-only (synthetic services only).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.APPDATA, 'npm/node_modules/openclaw/node_modules/playwright-core'));
const assets = path.resolve(__dirname, '../artifacts/worker-direct-pay-preview');
const output = path.resolve(__dirname, '../artifacts/worker-direct-pay-management');
const key = 'worker-direct-pay-preview';

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
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/workers');
            await page.getByRole('button', { name: '가상 작업자 기본 계좌·사진 등록/수정' }).click();
            await page.getByLabel('기본 계좌 예금주', { exact: true }).fill('다른 예금주');
            await page.getByRole('button', { name: '기본 계좌 저장', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            await page.getByRole('button', { name: '가상 작업자 직불용 계좌·사진 등록/수정' }).click();
            await page.getByRole('button', { name: '기본 계좌와 동일' }).click();
            await page.getByRole('alert').filter({ hasText: '예금주는 작업자 이름과 같아야' }).waitFor();
            assert.equal(await page.getByRole('button', { name: '직불용 계좌 저장', exact: true }).isDisabled(), true);
            await page.getByLabel('직불용 계좌 예금주', { exact: true }).fill('가상작업자');
            await page.getByRole('button', { name: '직불용 계좌 저장', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            await page.reload();
            await page.getByRole('button', { name: '가상 작업자 직불용 계좌·사진 등록/수정' }).waitFor();
            assert.match(await page.getByRole('button', { name: '가상 작업자 직불용 계좌·사진 등록/수정' }).getAttribute('title'), /계좌 등록됨 · 사진 등록됨/);
            await page.goto(origin + '/summary');
            await page.getByRole('checkbox', { name: '가상 작업자 선택' }).check();
            if (width < 600) await page.getByRole('button', { name: /요약.*1/ }).click();
            await page.getByRole('button', { name: '직불용 통장사본 등록', exact: true }).click();
            await page.getByRole('button', { name: '가상 작업자 직불용 계좌 등록/수정' }).click();
            await page.getByRole('button', { name: '직불용 계좌 삭제', exact: true }).click();
            await page.getByRole('button', { name: '삭제 취소', exact: true }).click();
            let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key))[0], key);
            assert.equal(saved.directPayAccountNumber, '001234567890');
            await page.getByRole('button', { name: '직불용 계좌 삭제', exact: true }).click();
            await page.screenshot({ path: path.join(output, `delete-confirm-${width}.png`), fullPage: true });
            await page.getByRole('button', { name: '삭제 확인', exact: true }).click();
            await page.getByText('직불 계좌 미등록 · 통장사본 미등록', { exact: true }).waitFor();
            await page.getByRole('button', { name: '직불용 통장사본 등록 닫기' }).click();
            await page.getByLabel('직불용 통장사본 미등록', { exact: true }).waitFor();
            await page.goto(origin + '/workers');
            await page.getByRole('button', { name: '가상 작업자 직불용 계좌·사진 등록/수정' }).waitFor();
            saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key))[0], key);
            for (const field of ['directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder', 'directPayBankPhotoId']) assert.equal(saved[field], '');
            assert.equal(saved.accountHolder, '다른 예금주');
            assert.equal(saved.accountNumber, '001234567890');
            assert.equal(saved.bankPhotoId, 'basic-photo');
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: 기본 타인 예금주, 직불 불일치 차단, 등록 후 재조회, 요약에서 삭제 취소/확인, 기본계좌 보존`);
            await context.close();
        }
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
