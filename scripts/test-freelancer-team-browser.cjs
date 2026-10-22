const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const XLSX = require('xlsx');

(async () => {
    const output = path.resolve(__dirname, '../artifacts/freelancer-team-preview');
    const browser = await chromium.launch({ channel: 'chrome', headless: true, downloadsPath: output });
    const errors = [];
    const checks = [];
    try {
        const page = await browser.newPage({ viewport: { width: 2200, height: 1000 } });
        page.on('pageerror', error => errors.push(error.message));
        // All responses are served from the synthetic bundle, without a server or remote requests.
        await page.route('**/*', async route => {
            const pathname = new URL(route.request().url()).pathname;
            const file = path.resolve(output, '.' + pathname);
            if (pathname.endsWith('.js') && file.startsWith(output + path.sep) && fs.existsSync(file)) {
                await route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(file) });
            } else {
                await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif}*{box-sizing:border-box}</style><div id="root"></div><script src="/preview.js"></script></html>' });
            }
        });
        await page.goto('http://127.0.0.1:4198');
        const workerRow = name => page.locator('.ht_master tbody tr').filter({ hasText: name });
        const values = async name => workerRow(name).locator('td').allTextContents();
        const chooseTeam = async name => {
            await page.getByRole('button', { name, exact: true }).click();
            await page.waitForFunction(team => document.querySelector('.black-title-bar')?.textContent.includes(team), name);
            await workerRow('검증 이동자').waitFor();
        };
        await workerRow('검증 이동자').waitFor();
        assert.equal((await values('검증 이동자'))[10], '1,000,000');
        assert.equal((await values('검증 이동자'))[11], '');
        assert.equal((await values('검증 복수팀'))[11], '300,000');
        checks.push('A팀: 이동 전 8월 금액 유지, 이동 후 9월 0원');
        await page.screenshot({ path: path.join(output, 'team-a.png'), fullPage: true });

        await chooseTeam('검증 B팀');
        assert.equal((await values('검증 이동자'))[10], '');
        assert.equal((await values('검증 이동자'))[11], '2,000,000');
        assert.equal((await values('검증 복수팀'))[11], '400,000');
        checks.push('B팀: 9월 귀속 및 동월 복수 팀 분리');
        await page.screenshot({ path: path.join(output, 'team-b.png'), fullPage: true });

        await workerRow('검증 이동자').locator('td').nth(11).dblclick();
        const editor = page.locator('textarea.handsontableInput:visible');
        await editor.fill('2100000');
        await editor.press('Enter');
        await page.getByRole('button', { name: '저장', exact: false }).click();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => document.body.dataset.savedPayments);
        assert.deepEqual(JSON.parse(await page.locator('body').getAttribute('data-saved-payments')), [{ freelancerId: 'moved', teamId: 'b', month: 9, amount: 2100000 }]);
        await chooseTeam('검증 A팀');
        assert.equal((await values('검증 이동자'))[10], '1,000,000');
        assert.equal((await values('검증 이동자'))[11], '');
        await chooseTeam('검증 B팀');
        assert.equal((await values('검증 이동자'))[11], '2,100,000');
        checks.push('B팀 수정·저장·재조회 후 A팀 이력 보존');

        await page.getByLabel('세무용 엑셀 월 선택').selectOption('9');
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: '세무서 제출 자료' }).click();
        const download = await downloaded;
        const excelPath = path.join(output, 'synthetic-tax-report.xlsx');
        await download.saveAs(excelPath);
        const workbook = XLSX.readFile(excelPath);
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        const details = sheet.slice(3).filter(row => typeof row[0] === 'number');
        assert.deepEqual(details.map(row => row[3]).sort((a, b) => a - b), [300000, 400000, 2100000]);
        checks.push('세무서 제출 엑셀: 팀별 내역과 전체 2,800,000원 일치');

        await page.goto('http://127.0.0.1:4198/?error');
        await page.getByRole('alert').waitFor();
        assert.match(await page.getByRole('alert').innerText(), /귀속을 확인/);
        assert.equal(await page.getByRole('button', { name: '세무서 제출 자료' }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: '저장', exact: false }).isDisabled(), true);
        checks.push('귀속 불명 수기값 오류 표시 및 저장·내보내기 차단');
        assert.deepEqual(errors, []);
        const result = { passed: true, checks, pageErrors: errors };
        fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
