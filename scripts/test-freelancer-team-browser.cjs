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
        // Capture the generated workbook before the browser/OS download policy intervenes.
        await page.addInitScript(() => {
            const createObjectURL = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => { window.generatedWorkbook = blob; return createObjectURL(blob); };
        });
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
        const historyButton = name => page.locator('.ht_clone_inline_start').getByRole('button', { name: new RegExp(`${name}.*신고 내역 보기`) });
        const nameStyle = async name => workerRow(name).locator('td').nth(1).evaluate(cell => ({
            background: getComputedStyle(cell).backgroundColor,
            color: getComputedStyle(cell).color,
            title: cell.title,
            previousTeam: cell.dataset.previousTeamId,
        }));
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
        assert.equal((await nameStyle('검증 이동자')).background, 'rgb(124, 58, 237)');
        assert.equal((await nameStyle('검증 이동자')).previousTeam, undefined);
        assert.deepEqual(await historyButton('검증 세팀신고').locator('.freelancer-history-team-chip').evaluateAll(chips => chips.map(chip => ({
            teamId: chip.dataset.teamId, background: getComputedStyle(chip).backgroundColor, color: getComputedStyle(chip).color,
        }))), [
            { teamId: 'b', background: 'rgb(124, 58, 237)', color: 'rgb(255, 255, 255)' },
            { teamId: 'c', background: 'rgb(15, 118, 110)', color: 'rgb(255, 255, 255)' },
        ]);
        assert.equal(await historyButton('검증 세팀신고').evaluate(button => button.getBoundingClientRect().bottom <= button.closest('td').getBoundingClientRect().bottom), true);
        checks.push('이후 다른 팀 신고도 이름에 색상 표시, 여러 다른 팀의 색상·팀명 모두 표시');
        await page.screenshot({ path: path.join(output, 'team-a.png'), fullPage: true });

        await chooseTeam('검증 B팀');
        assert.deepEqual(await nameStyle('검증 이동자'), {
            background: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)', previousTeam: 'a',
            title: '이전 신고팀: 검증 A팀 (8월)\n' + new Date().getFullYear() + '년 팀별 신고 내역\n검증 A팀 · 합계 1,000,000원\n  8월 1,000,000원\n검증 B팀 · 합계 2,000,000원\n  9월 2,000,000원',
        });
        assert.equal((await nameStyle('검증 복수팀')).previousTeam, undefined);
        assert.equal((await nameStyle('검증 복수팀')).background, 'rgb(0, 0, 0)');
        checks.push('이전 검정 팀 배경·흰 글씨 및 팀별 금액 안내, 동월 복수팀은 이동으로 표시하지 않음');
        assert.equal((await values('검증 이동자'))[10], '');
        assert.equal((await values('검증 이동자'))[11], '2,000,000');
        assert.equal((await values('검증 복수팀'))[11], '400,000');
        checks.push('B팀: 9월 귀속 및 동월 복수 팀 분리');
        await page.screenshot({ path: path.join(output, 'team-b.png'), fullPage: true });

        assert.match(await historyButton('검증 이동자').innerText(), /이전: 검증 A팀/);
        await historyButton('검증 이동자').click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.match(await dialog.innerText(), /검증 이동자 · 어디서 얼마를 신고했나요/);
        assert.match(await dialog.getByRole('region', { name: '검증 A팀 신고 내역' }).innerText(), /8월[\s\S]*1,000,000원/);
        assert.match(await dialog.getByRole('region', { name: '검증 B팀 신고 내역' }).innerText(), /9월[\s\S]*2,000,000원/);
        assert.match(await dialog.locator('footer').innerText(), /3,000,000원/);
        assert.deepEqual(await dialog.locator('h3.freelancer-history-team-chip').evaluateAll(chips => chips.map(chip => getComputedStyle(chip).backgroundColor)), ['rgb(0, 0, 0)', 'rgb(124, 58, 237)']);
        assert.equal(await page.locator('body').getAttribute('data-saved-payments'), null);
        await page.screenshot({ path: path.join(output, 'history-details.png'), fullPage: true });
        await dialog.getByRole('button', { name: '신고 내역 닫기' }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.match(await historyButton('검증 복수팀').innerText(), /같은 달 여러 팀 신고/);
        await historyButton('검증 복수팀').click();
        await dialog.waitFor();
        assert.match(await dialog.locator('.freelancer-history-notice').innerText(), /9월에는 여러 팀에서 신고/);
        assert.match(await dialog.locator('footer').innerText(), /700,000원/);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        await page.screenshot({ path: path.join(output, 'history-shared-mobile.png'), fullPage: true });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        await page.setViewportSize({ width: 2200, height: 1000 });
        checks.push('이전 팀·같은 달 여러 팀 표시, 클릭 상세 월별 금액·합계, 모바일 화면 및 닫기 검증');

        // An edit must update the visible exception marker without a save or team switch.
        await workerRow('검증 복수팀').locator('td').nth(11).dblclick();
        await page.locator('textarea.handsontableInput:visible').fill('0');
        await page.locator('textarea.handsontableInput:visible').press('Enter');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.ht_clone_inline_start button'))
            .some(button => button.getAttribute('aria-label')?.includes('검증 복수팀') && button.textContent.includes('이전: 검증 A팀')), null, { timeout: 2000 });
        await historyButton('검증 복수팀').focus();
        await page.keyboard.press('Enter');
        await dialog.waitFor();
        assert.match(await dialog.innerText(), /지금 보고 있는 팀에는 신고 금액이 없습니다/);
        assert.match(await dialog.locator('footer').innerText(), /300,000원/);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        await workerRow('검증 복수팀').locator('td').nth(11).dblclick();
        await page.locator('textarea.handsontableInput:visible').fill('400000');
        await page.locator('textarea.handsontableInput:visible').press('Enter');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.ht_clone_inline_start button'))
            .some(button => button.getAttribute('aria-label')?.includes('검증 복수팀') && button.textContent.includes('같은 달 여러 팀 신고')));
        checks.push('0원 수정·되돌리기 직후 안내 갱신, 키보드 상세보기 및 현재 팀 미신고 안내');

        await workerRow('검증 이동자').locator('td').nth(11).dblclick();
        const editor = page.locator('textarea.handsontableInput:visible');
        await editor.fill('2100000');
        await editor.press('Enter');
        await historyButton('검증 이동자').click();
        await dialog.waitFor();
        assert.match(await dialog.locator('footer').innerText(), /3,100,000원/);
        await dialog.getByRole('button', { name: '신고 내역 닫기' }).click();
        await page.getByRole('button', { name: '저장', exact: false }).click();
        await page.locator('.swal2-confirm').click();
        await page.waitForFunction(() => document.body.dataset.savedPayments);
        assert.deepEqual(JSON.parse(await page.locator('body').getAttribute('data-saved-payments')), [{ freelancerId: 'moved', teamId: 'b', month: 9, amount: 2100000 }]);
        await chooseTeam('검증 A팀');
        assert.equal((await nameStyle('검증 이동자')).previousTeam, undefined);
        assert.equal((await values('검증 이동자'))[10], '1,000,000');
        assert.equal((await values('검증 이동자'))[11], '');
        await chooseTeam('검증 B팀');
        assert.equal((await values('검증 이동자'))[11], '2,100,000');
        checks.push('B팀 수정·저장·재조회 후 A팀 이력 보존');

        await page.getByLabel('세무용 엑셀 월 선택').selectOption('9');
        await page.getByRole('button', { name: '세무서 제출 자료' }).click();
        await page.waitForFunction(() => window.generatedWorkbook instanceof Blob);
        const excelPath = path.join(output, 'synthetic-tax-report.xlsx');
        const workbookBytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.generatedWorkbook.arrayBuffer())));
        fs.writeFileSync(excelPath, Buffer.from(workbookBytes));
        const workbook = XLSX.readFile(excelPath);
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        const details = sheet.slice(3).filter(row => typeof row[0] === 'number');
        assert.deepEqual(details.map(row => row[3]).sort((a, b) => a - b), [300000, 400000, 2100000]);
        checks.push('세무서 제출 엑셀: 팀별 내역과 전체 2,800,000원 일치');

        await page.getByRole('button', { name: '검증 C팀', exact: true }).click();
        await workerRow('검증 보라팀이동').waitFor();
        assert.equal((await nameStyle('검증 보라팀이동')).background, 'rgb(124, 58, 237)');
        assert.equal((await nameStyle('검증 보라팀이동')).color, 'rgb(255, 255, 255)');
        assert.equal((await nameStyle('검증 이동없음')).previousTeam, undefined);
        assert.equal((await nameStyle('검증 이동없음')).title, '');
        assert.equal(await historyButton('검증 이동없음').count(), 0);
        assert.equal(await page.locator('.ht_master tr').filter({ hasText: '합 계' }).locator('.freelancer-previous-team-cell').count(), 0);
        await page.screenshot({ path: path.join(output, 'team-c.png'), fullPage: true });
        checks.push('이전 보라 팀 배경·흰 글씨, 일반·빈·합계 행에 색상 잔류 없음');

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
