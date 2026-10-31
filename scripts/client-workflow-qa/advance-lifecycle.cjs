// Uses only the guarded demo-client-workflow emulators and synthetic fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, pageFor, output, origin } = require('./browser.cjs');
process.env.GCLOUD_PROJECT = 'demo-client-workflow';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18089';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099';
const { db, admin } = require('./state.cjs');

(async () => {
  const month = '2026-10';
  const base = { workerId: 'qa-leader-worker', workerName: '합성 팀장', teamId: 'qa-team', teamName: '합성 검수팀',
    requesterUid: 'qa-leader', yearMonth: month, periodStart: `${month}-01`, periodEnd: `${month}-31`,
    category: 'first', requestedAmount: 10000, status: 'requested', createdAt: admin.firestore.Timestamp.now() };
  for (const [name, status] of [['summary', 'requested'], ['worker', 'requested'], ['approved', 'approved'], ['paid', 'paid']]) {
    await db.doc(`advance_requests/qa-lifecycle-${name}`).set({ ...base, status, memo: `lifecycle-${name}` });
  }
  const browser = await launch();
  const results = [];
  try {
    const office = await pageFor(browser, 'office', 1440);
    office.page.removeAllListeners('dialog');
    office.page.on('dialog', dialog => dialog.accept());
    await office.page.goto(`${origin}/payroll/advance-summary?yearMonth=${month}`);
    await office.page.getByRole('button', { name: '신청 취소·삭제', exact: true }).click();
    const dialog = office.page.getByRole('dialog', { name: '가불 신청 관리' });
    const summary = dialog.getByRole('article').filter({ hasText: 'lifecycle-summary' });
    await summary.getByRole('button', { name: '신청 취소', exact: true }).click();
    await dialog.getByText('신청을 취소했습니다.', { exact: true }).waitFor();
    assert.equal((await db.doc('advance_requests/qa-lifecycle-summary').get()).data().status, 'cancelled');
    for (const name of ['approved', 'paid']) assert.equal(await dialog.getByRole('article').filter({ hasText: `lifecycle-${name}` }).getByRole('button').count(), 0);
    await office.page.screenshot({ path: path.join(output, 'advance-lifecycle-desktop.png'), fullPage: true });
    await office.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await dialog.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth && element.scrollWidth <= element.clientWidth + 1), true);
    await office.page.screenshot({ path: path.join(output, 'advance-lifecycle-summary-mobile.png'), fullPage: true });
    await summary.getByRole('button', { name: '삭제', exact: true }).click();
    await dialog.getByText('신청 내역을 삭제했습니다.', { exact: true }).waitFor();
    assert.ok((await db.doc('advance_requests/qa-lifecycle-summary').get()).data().deletedAt);
    await office.page.reload();
    await office.page.getByRole('button', { name: '신청 취소·삭제', exact: true }).click();
    await dialog.getByRole('article').filter({ hasText: 'lifecycle-worker' }).waitFor();
    assert.equal(await dialog.getByRole('article').filter({ hasText: 'lifecycle-summary' }).count(), 0);
    results.push('팀별 가불내역: 관리자 취소·삭제, 새로고침 후 삭제 유지, 승인·지급 보호, 데스크톱·모바일 관리 창');

    const leader = await pageFor(browser, 'leader', 390);
    leader.page.removeAllListeners('dialog');
    leader.page.on('dialog', dialog => dialog.accept());
    await leader.page.goto(`${origin}/payroll/advance-request`);
    await leader.page.getByLabel('기준월', { exact: true }).fill(month);
    const request = leader.page.getByRole('article').filter({ hasText: 'lifecycle-worker' });
    await request.getByRole('button', { name: '신청 취소', exact: true }).click();
    await leader.page.getByText('신청을 취소했습니다.', { exact: true }).waitFor();
    assert.equal((await db.doc('advance_requests/qa-lifecycle-worker').get()).data().status, 'cancelled');
    await request.scrollIntoViewIfNeeded();
    await leader.page.screenshot({ path: path.join(output, 'advance-lifecycle-worker-mobile.png'), fullPage: true });
    await request.getByRole('button', { name: '삭제', exact: true }).click();
    await leader.page.getByText('신청 내역을 삭제했습니다.', { exact: true }).waitFor();
    assert.ok((await db.doc('advance_requests/qa-lifecycle-worker').get()).data().deletedAt);
    await leader.page.reload();
    await leader.page.getByRole('article').filter({ hasText: 'lifecycle-approved' }).waitFor();
    assert.equal(await leader.page.getByRole('article').filter({ hasText: 'lifecycle-worker' }).count(), 0);
    results.push('가불신청: 모바일 본인 신청 취소→내역 유지→삭제→새로고침 후 제외');
    assert.deepEqual([...office.errors, ...leader.errors], []);
    fs.writeFileSync(path.join(output, 'advance-lifecycle-results.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }));
  } finally { await browser.close(); await admin.app().delete(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
