const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
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
            teamColor: cell.style.getPropertyValue('--previous-team-background'),
            color: getComputedStyle(cell).color,
            title: cell.title,
            previousTeam: cell.dataset.previousTeamId,
        }));
        const chooseTeam = async name => {
            await page.getByRole('button', { name: name + ' 선택', exact: true }).click();
            await page.getByRole('heading', { name, exact: true }).waitFor();
            await workerRow('검증 이동자').waitFor();
        };
        const teamButtons = page.getByRole('group', { name: '팀 선택' });
        const teamOrder = () => teamButtons.getByRole('button').allTextContents();
        const waitForDragFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.getByRole('heading', { name: '검증 A팀', exact: true }).waitFor();
        await workerRow('검증 이동자').locator('td').nth(10).dblclick();
        const unsavedAmount = page.locator('textarea.handsontableInput:visible');
        await unsavedAmount.fill('1111000');
        await unsavedAmount.press('Enter');
        await page.getByRole('button', { name: '순서 변경', exact: true }).click();
        const from = await teamButtons.getByRole('button', { name: '검증 A팀 순서 변경' }).boundingBox();
        const to = await teamButtons.getByRole('button', { name: '검증 B팀 순서 변경' }).boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 });
        await waitForDragFrame();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
        await waitForDragFrame();
        await page.mouse.up();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture:freelancer:company-team-order')), null);
        await page.getByText('Draggable item a was dropped over droppable area b', { exact: true }).waitFor({ state: 'attached' });
        await page.getByRole('button', { name: '순서 변경 완료' }).click({ delay: 100 });
        await teamButtons.getByRole('button', { name: '검증 B팀 선택' }).waitFor();
        assert.deepEqual(await teamOrder(), ['검증 B팀', '검증 A팀', '검증 C팀']);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture:freelancer:company-team-order')), '["b","hidden","a","c"]');
        assert.equal((await values('검증 이동자'))[10], '1,111,000');
        await teamButtons.getByRole('button', { name: '검증 A팀 선택' }).click();
        await teamButtons.getByRole('button', { name: '검증 B팀 선택' }).click();
        await page.getByRole('heading', { name: '미저장 데이터 경고' }).waitFor();
        await page.locator('.swal2-cancel').click();
        assert.equal((await values('검증 이동자'))[10], '1,111,000');
        assert.equal(await page.locator('body').getAttribute('data-saved-payments'), null);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await page.getByRole('heading', { name: '검증 B팀', exact: true }).waitFor();
        assert.deepEqual(await teamOrder(), ['검증 B팀', '검증 A팀', '검증 C팀']);
        await page.getByRole('button', { name: '순서 변경', exact: true }).click();
        const handle = teamButtons.getByRole('button', { name: '검증 B팀 순서 변경' });
        await handle.focus();
        await page.keyboard.press('Space');
        await page.getByText('Draggable item b was moved over droppable area b.', { exact: true }).waitFor({ state: 'attached' });
        await page.keyboard.press('ArrowRight');
        await page.getByText('Draggable item b was moved over droppable area a.', { exact: true }).waitFor({ state: 'attached' });
        await page.keyboard.press('Space');
        await page.getByText('Draggable item b was dropped over droppable area a', { exact: true }).waitFor({ state: 'attached' });
        await page.getByRole('button', { name: '순서 변경 완료' }).click();
        await teamButtons.getByRole('button', { name: '검증 A팀 선택' }).waitFor();
        assert.deepEqual(await teamOrder(), ['검증 A팀', '검증 B팀', '검증 C팀']);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture:freelancer:company-team-order')), '["a","hidden","b","c"]');
        await page.getByRole('button', { name: '순서 변경', exact: true }).click();
        await page.getByRole('button', { name: '기본 순서' }).click();
        await teamButtons.getByRole('button', { name: '검증 B팀 선택' }).waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture:freelancer:company-team-order')), '[]');
        await page.setViewportSize({ width: 2200, height: 1000 });
        await page.reload();
        await page.getByRole('heading', { name: '검증 A팀', exact: true }).waitFor();
        checks.push('회사 공통 순서: 드래그·키보드 이동, 숨은 팀 위치, 재접속, 기본 순서, 미저장 신고액 보호');
        await workerRow('검증 이동자').waitFor();
        assert.equal((await values('검증 이동자'))[10], '1,000,000');
        assert.equal((await values('검증 이동자'))[11], '');
        assert.equal((await values('검증 복수팀'))[11], '300,000');
        checks.push('A팀: 이동 전 8월 금액 유지, 이동 후 9월 0원');
        assert.equal((await nameStyle('검증 이동자')).teamColor, '#7c3aed');
        assert.equal((await nameStyle('검증 이동자')).previousTeam, undefined);
        const chips = await historyButton('검증 세팀신고').locator('.freelancer-history-team-chip').evaluateAll(nodes => nodes.map(chip => ({
            teamId: chip.dataset.teamId, accent: chip.style.getPropertyValue('--freelancer-history-color'),
            background: getComputedStyle(chip).backgroundColor, color: getComputedStyle(chip).color,
        })));
        assert.deepEqual(chips.map(({ teamId, accent, color }) => [teamId, accent, color]), [
            ['b', '#7c3aed', 'rgb(51, 65, 85)'], ['c', '#0f766e', 'rgb(51, 65, 85)'],
        ]);
        assert.notEqual(chips[0].background, chips[1].background);
        assert.equal(await historyButton('검증 세팀신고').evaluate(button => button.getBoundingClientRect().bottom <= button.closest('td').getBoundingClientRect().bottom), true);
        assert.equal(await historyButton('검증 세팀신고').innerText(), '검증 B팀\n검증 C팀');
        checks.push('이후 다른 팀 신고도 이름에 색상 표시, 여러 다른 팀의 색상·팀명 모두 표시');
        await page.screenshot({ path: path.join(output, 'team-a.png'), fullPage: true });

        await chooseTeam('검증 B팀');
        assert.deepEqual(await nameStyle('검증 이동자'), {
            teamColor: '#000000', color: 'rgb(23, 43, 70)', previousTeam: 'a',
            title: '이전 신고팀: 검증 A팀 (8월)\n' + new Date().getFullYear() + '년 팀별 신고 내역\n검증 A팀 · 합계 1,000,000원\n  8월 1,000,000원\n검증 B팀 · 합계 2,000,000원\n  9월 2,000,000원',
        });
        assert.equal((await nameStyle('검증 복수팀')).previousTeam, undefined);
        assert.equal((await nameStyle('검증 복수팀')).teamColor, '#000000');
        checks.push('이전 검정 팀 색상 및 팀별 금액 안내, 동월 복수팀은 이동으로 표시하지 않음');
        assert.equal((await values('검증 이동자'))[10], '');
        assert.equal((await values('검증 이동자'))[11], '2,000,000');
        assert.equal((await values('검증 복수팀'))[11], '400,000');
        checks.push('B팀: 9월 귀속 및 동월 복수 팀 분리');
        await page.screenshot({ path: path.join(output, 'team-b.png'), fullPage: true });

        assert.equal(await historyButton('검증 이동자').innerText(), '검증 A팀');
        assert.doesNotMatch(await page.locator('.ht_master tbody').innerText(), /다른 팀 신고 있음|이전 팀 신고 내역|이전:|같은 달 여러 팀 신고/);
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
        assert.equal(await historyButton('검증 복수팀').innerText(), '검증 A팀');
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
        checks.push('목록은 색상과 팀명만 표시, 클릭 상세 월별 금액·합계·동월 안내, 모바일 화면 및 닫기 검증');

        // An edit must update the visible exception marker without a save or team switch.
        await workerRow('검증 복수팀').locator('td').nth(11).dblclick();
        await page.locator('textarea.handsontableInput:visible').fill('0');
        await page.locator('textarea.handsontableInput:visible').press('Enter');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.ht_clone_inline_start button'))
            .some(button => button.getAttribute('aria-label')?.includes('검증 복수팀') && button.closest('td')?.dataset.previousTeamId === 'a'), null, { timeout: 2000 });
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
            .some(button => button.getAttribute('aria-label')?.includes('검증 복수팀') && !button.closest('td')?.dataset.previousTeamId));
        await historyButton('검증 복수팀').click();
        await dialog.waitFor();
        assert.match(await dialog.locator('.freelancer-history-notice').innerText(), /9월에는 여러 팀에서 신고/);
        assert.match(await dialog.locator('footer').innerText(), /700,000원/);
        await dialog.getByRole('button', { name: '신고 내역 닫기' }).click();
        checks.push('0원 수정·복원 후 상세 갱신, 팀명 키보드 상세보기 및 현재 팀 미신고 안내');

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

        await page.getByRole('button', { name: '검증 C팀 선택', exact: true }).click();
        await workerRow('검증 보라팀이동').waitFor();
        assert.equal((await nameStyle('검증 보라팀이동')).teamColor, '#7c3aed');
        assert.equal((await nameStyle('검증 보라팀이동')).color, 'rgb(23, 43, 70)');
        assert.equal((await nameStyle('검증 이동없음')).previousTeam, undefined);
        assert.equal((await nameStyle('검증 이동없음')).title, '');
        assert.equal(await historyButton('검증 이동없음').count(), 0);
        assert.equal(await page.locator('.ht_master tr').filter({ hasText: '합 계' }).locator('.freelancer-previous-team-cell').count(), 0);
        await page.screenshot({ path: path.join(output, 'team-c.png'), fullPage: true });
        checks.push('이전 보라 팀 색상, 일반·빈·합계 행에 색상 잔류 없음');

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
