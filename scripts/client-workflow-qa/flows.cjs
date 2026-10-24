const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { launch, pageFor, output, origin } = require('./browser.cjs');
process.env.GCLOUD_PROJECT = 'demo-client-workflow';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18089';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099';
const { db, admin } = require('./state.cjs');
const outcomes = [];
const save = () => fs.writeFileSync(path.join(output, 'flow-results.json'), JSON.stringify(outcomes, null, 2));
const passed = name => { outcomes.push({ name, passed: true }); save(); console.log(`PASS ${name}`); };
async function until(check, message) {
  for (let attempt = 0; attempt < 50; attempt++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 300)); }
  throw new Error(message);
}
(async () => {
  // Normalize the owned synthetic fixture, never an operational record.
  for (const collection of ['companies', 'teams', 'workers', 'sites', 'daily_reports']) {
    const records = await db.collection(collection).get();
    for (const record of records.docs) if (record.id.startsWith('qa-') && !record.data().createdAt) await record.ref.update({ createdAt: admin.firestore.Timestamp.now() });
  }
  await db.doc('companies/qa-company').update({ type: '시공사', code: 'QA-COMPANY' });
  await db.doc('teams/qa-other-team').update({ type: '시공팀' });
  await db.doc('teams/qa-team').update({ type: '시공팀' });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const reportDocs = await db.collection('daily_reports').get();
  for (const report of reportDocs.docs) if (report.id.startsWith('qa-') && !report.data().date.startsWith(currentMonth)) {
    await report.ref.update({ totalManDay: 1, workers: report.data().workers.map(worker => ({ ...worker, manDay: 0.5, amount: worker.unitPrice * 0.5 })) });
  }
  await db.doc('users/qa-member').update({ status: 'pending', position: admin.firestore.FieldValue.delete(), linkedWorkerIds: [], accountType: admin.firestore.FieldValue.delete(), requestedAccountType: 'worker', primaryLinkId: 'qa-member-link' });
  await db.doc('workers/qa-member-worker').update({ uid: admin.firestore.FieldValue.delete() });
  await db.doc('account_links/qa-member-link').update({ status: 'pending' });
  const oldRequests = await db.collection('advance_requests').where('requesterUid', '==', 'qa-leader').get();
  for (const record of oldRequests.docs) await record.ref.delete();
  const browser = await launch();
  let current;
  try {
    const pending = await pageFor(browser, 'member'); current = pending.page;
    await pending.page.getByText(/승인.*대기|대기.*승인/).first().waitFor({ timeout: 30000 });
    passed('실제 Auth 로그인: 미승인 팀원은 업무 화면 대신 승인 대기');
    const lead = await pageFor(browser, 'leader'); current = lead.page;
    await lead.page.goto(origin + '/manpower/team-account-approvals');
    await lead.page.getByText('합성 팀원', { exact: true }).waitFor();
    assert.equal(await lead.page.getByText('타팀 합성', { exact: true }).count(), 0);
    await lead.page.getByRole('checkbox').check();
    await lead.page.getByRole('button', { name: '선택 1건 승인·갱신', exact: true }).click();
    const confirm = lead.page.getByRole('dialog');
    await confirm.getByText(/합성 팀원/).waitFor();
    await confirm.getByRole('button', { name: '확인 후 승인·갱신' }).click();
    await until(async () => (await db.doc('users/qa-member').get()).data().status === 'active', 'account not activated');
    assert.equal((await db.doc('workers/qa-member-worker').get()).data().uid, 'qa-member');
    assert.equal((await db.doc('users/qa-outside').get()).data().status, 'pending');
    await lead.page.screenshot({ path: path.join(output, 'flow-account-approved.png'), fullPage: true });
    passed('팀장 화면 → 실제 서버 승인 → 계정·작업자 연결 저장, 타팀 대기 유지');
    await pending.context.close();
    const member = await pageFor(browser, 'member'); current = member.page;
    await member.page.locator('#main-content').waitFor({ timeout: 30000 });
    assert.equal((await db.doc('users/qa-member').get()).data().status, 'active');
    passed('승인된 팀원의 새 브라우저 재로그인: 재승인 없이 업무 화면 진입');
    await member.context.close();

    current = lead.page;
    await lead.page.goto(origin + '/payroll/advance-request');
    await lead.page.getByRole('button', { name: /^합성 팀원/ }).click();
    await lead.page.getByText('합성은행', { exact: false }).waitFor();
    const amount = lead.page.locator('input[inputmode=numeric]').first();
    await amount.fill('100000');
    const submit = lead.page.getByRole('button', { name: '가불 신청', exact: true });
    await submit.click();
    await lead.page.getByText('가불 신청을 등록했습니다.', { exact: true }).waitFor();
    const requests = await db.collection('advance_requests').where('requesterUid', '==', 'qa-leader').get();
    assert.equal(requests.size, 1);
    const request = requests.docs[0];
    assert.equal(request.data().requestedAmount, 100000);
    assert.equal(request.data().workerId, 'qa-member-worker');
    await lead.page.screenshot({ path: path.join(output, 'flow-advance-submitted.png'), fullPage: true });
    passed('팀장 대리 가불 신청: 실제 저장 1건, 대상·금액·계좌 확인');
    const office = await pageFor(browser, 'office', 1366); current = office.page;
    office.page.removeAllListeners('dialog');
    office.page.on('dialog', dialog => dialog.accept('합성 검수'));
    await office.page.goto(origin + '/office/request-center?type=advance&status=all');
    await office.page.getByText('합성 팀원 가불 신청', { exact: true }).waitFor();
    await office.page.getByRole('button', { name: '승인', exact: true }).click();
    await until(async () => (await request.ref.get()).data().status === 'approved', 'office did not approve');
    await office.page.getByRole('button', { name: '지급완료', exact: true }).click();
    await until(async () => (await request.ref.get()).data().status === 'paid', 'office did not mark paid');
    await office.page.screenshot({ path: path.join(output, 'flow-office-paid.png'), fullPage: true });
    await lead.page.reload();
    await lead.page.getByRole('button', { name: /^합성 팀원/ }).click();
    await lead.page.getByText('지급완료', { exact: true }).waitFor();
    passed('사무실 요청함 접수 → 승인 → 지급완료 상태, 팀장 재조회 일치');

    current = office.page;
    await office.page.setViewportSize({ width: 390, height: 900 });
    await office.page.goto(origin + '/payroll/team-settlement');
    await office.page.getByRole('button', { name: /합성 검수팀/ }).first().click();
    await office.page.getByRole('region', { name: '매입 내역', exact: true }).waitFor({ timeout: 30000 });
    const bar = office.page.getByRole('region', { name: '정산 상태와 실행 작업' });
    const before = await bar.innerText();
    const summaryBefore = await office.page.getByRole('region', { name: '정산 요약' }).innerText();
    await office.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await office.page.waitForTimeout(350);
    const box = await bar.boundingBox();
    assert.ok(box && box.y >= 45 && box.y < 120, `settlement sticky top: ${box?.y}`);
    await bar.getByRole('button', { name: '이전 달' }).click();
    await until(async () => (await bar.innerText()) !== before, 'settlement month did not change');
    await until(async () => (await office.page.getByRole('region', { name: '정산 요약' }).innerText()) !== summaryBefore, 'settlement figures did not follow the selected month');
    await office.page.screenshot({ path: path.join(output, 'flow-settlement-sticky.png'), fullPage: false });
    passed('실제 정산 전체 페이지: 팀 자료 로딩·하단 스크롤·고정 월 이동');
    assert.deepEqual(lead.errors, []); assert.deepEqual(office.errors, []);
  } catch (error) {
    if (current) { await current.screenshot({ path: path.join(output, 'flow-failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(output, 'flow-failure.txt'), await current.locator('body').innerText().catch(() => '')); }
    outcomes.push({ passed: false, reason: error.message }); save(); throw error;
  } finally { await browser.close(); await admin.app().delete(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
