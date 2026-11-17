// Run after: node scripts/worker-direct-pay-preview.cjs --build-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(process.env.APPDATA, 'npm/node_modules/openclaw/node_modules/playwright-core'));
const assets = path.resolve(__dirname, '../artifacts/worker-direct-pay-preview');
const output = path.resolve(__dirname, '../artifacts/worker-form-bankbooks');

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
            const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('worker-form-accounts-preview') || 'null'));
            const openAccount = async label => {
                await page.getByRole('button', { name: label + ' 통장사본 등록·수정', exact: true }).click();
                return page.getByRole('dialog');
            };
            const photo = { name: 'synthetic-bank.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
            await page.getByPlaceholder('이름 입력').fill('가상작업자');
            await page.getByLabel('주민·외국인등록번호', { exact: true }).fill('000000-1000000');
            let dialog = await openAccount('기본 계좌');
            await dialog.getByLabel('기본 계좌 사진 선택', { exact: true }).setInputFiles(photo);
            await dialog.getByText('Gemini가 계좌정보를 자동입력했습니다.', { exact: false }).waitFor();
            assert.equal(await dialog.getByLabel('기본 계좌 예금주', { exact: true }).inputValue(), '가상 분석예금주');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: path.join(output, 'bankbook-gemini-' + width + '.png'), fullPage: true });
            await dialog.getByRole('button', { name: '입력 적용', exact: true }).click();
            dialog = await openAccount('직불용 계좌');
            await dialog.getByRole('button', { name: '기본 계좌와 동일', exact: true }).click();
            await dialog.getByText('기본 계좌정보와 사진을 가져왔습니다.', { exact: false }).waitFor();
            assert.equal(await dialog.getByRole('button', { name: '입력 적용', exact: true }).isDisabled(), true);
            await dialog.getByLabel('직불용 계좌 예금주', { exact: true }).fill('가상작업자');
            await dialog.getByRole('button', { name: '입력 적용', exact: true }).click();
            assert.equal(await snapshot(), null);
            await page.getByRole('button', { name: '등록 완료', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            const first = await snapshot();
            assert.match(first.bankPhotoId, /^[a-f0-9]{32}$/); assert.match(first.directPayBankPhotoId, /^[a-f0-9]{32}$/);
            assert.notEqual(first.bankPhotoId, first.directPayBankPhotoId);
            await page.reload();
            dialog = await openAccount('기본 계좌');
            await dialog.getByRole('button', { name: '등록된 사진 보기', exact: true }).click();
            await dialog.getByAltText('기본 계좌 사진 미리보기', { exact: true }).waitFor();
            await dialog.getByLabel('기본 계좌 사진 선택', { exact: true }).setInputFiles(photo);
            await dialog.getByText('Gemini가 계좌정보를 자동입력했습니다.', { exact: false }).waitFor();
            await dialog.getByLabel('기본 계좌 예금주', { exact: true }).fill('수정예금주');
            await dialog.getByRole('button', { name: '입력 적용', exact: true }).click();
            await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            const changed = await snapshot();
            assert.notEqual(changed.bankPhotoId, first.bankPhotoId); assert.equal(changed.directPayBankPhotoId, first.directPayBankPhotoId);
            assert.equal(changed.accountHolder, '수정예금주');
            await page.reload();
            dialog = await openAccount('기본 계좌');
            await dialog.getByRole('button', { name: '통장사본만 삭제', exact: true }).click();
            await dialog.getByRole('button', { name: '사진 삭제 확인', exact: true }).click();
            assert.equal((await snapshot()).bankPhotoId, changed.bankPhotoId);
            await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            const photoDeleted = await snapshot();
            assert.equal(photoDeleted.bankPhotoId, ''); assert.equal(photoDeleted.accountHolder, '수정예금주');
            assert.equal(photoDeleted.directPayBankPhotoId, first.directPayBankPhotoId);
            await page.reload();
            dialog = await openAccount('직불용 계좌');
            await dialog.getByRole('button', { name: '직불용 계좌 삭제', exact: true }).click();
            await page.screenshot({ path: path.join(output, 'bankbook-delete-' + width + '.png'), fullPage: true });
            await dialog.getByRole('button', { name: '삭제 확인', exact: true }).click();
            await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
            await page.getByText('가상 작업자 저장 완료', { exact: true }).waitFor();
            await page.reload();
            const deleted = await snapshot();
            for (const key of ['directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder', 'directPayBankPhotoId']) assert.equal(deleted[key], '');
            assert.equal(deleted.accountHolder, '수정예금주');
            dialog = await openAccount('기본 계좌');
            await dialog.getByLabel('기본 계좌 사진 선택', { exact: true }).setInputFiles(photo);
            await dialog.getByText('Gemini가 계좌정보를 자동입력했습니다.', { exact: false }).waitFor();
            await dialog.getByRole('button', { name: '입력 적용', exact: true }).click();
            await page.getByRole('button', { name: '취소', exact: true }).click();
            assert.deepEqual(await snapshot(), deleted);
            assert.deepEqual(errors, []);
            console.log('PASS ' + width + 'px: 신규 통장사본 Gemini 등록, 기본사진 복사, 수정·교체·조회, 사진 삭제, 계좌 전체 삭제, 취소 보존');
            await context.close();
        }
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
