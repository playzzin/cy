const { launch, pageFor, output, origin } = require('./browser.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await launch();
  try {
    const { page, errors } = await pageFor(browser, 'office', 390);
    await page.goto(origin + '/payroll/team-settlement');
    await page.getByRole('button', { name: /합성 검수팀/ }).first().click();
    const carry = page.getByLabel('전월 이월', { exact: true });
    await carry.waitFor(); await carry.fill('12345'); await carry.blur();
    const bar = page.getByRole('region', { name: '정산 상태와 실행 작업' });
    const before = await bar.getByRole('group', { name: '정산 조회월' }).innerText();
    await bar.getByRole('button', { name: '이전 달' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await bar.getByRole('group', { name: '정산 조회월' }).innerText(), before);
    assert.equal((await carry.inputValue()).replace(/,/g, ''), '12345');
    await bar.getByRole('button', { name: '이전 달' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '저장 안 함', exact: true }).click();
    await page.waitForFunction(value => document.querySelector('#team-settlement-prev-carryover').value.replace(/,/g, '') !== value, '12345');
    assert.notEqual(await bar.getByRole('group', { name: '정산 조회월' }).innerText(), before);
    assert.equal(await bar.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'settlement-guard.png') });
    fs.writeFileSync(path.join(output, 'settlement-guard-results.json'), JSON.stringify({ passed: true, cancelKeepsMonthAndAmount: true, discardMovesMonth: true, opaqueStickyBackground: true }, null, 2));
    console.log('PASS settlement cancel/discard + opaque sticky bar');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
