const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerTeamWorkerMenu } = require('./register-team-worker-menu.cjs');
test('통합메뉴 직책 ID를 사용하고 기존 인원현황을 보존하며 재실행 시 중복하지 않는다', () => {
  const before = {
    admin: { positionConfig: [{ id: 'dynamic-leader-id', name: '팀장' }, { id: 'custom-office', name: '사무실' }], menu: [{ text: '운영 관리', sub: [] }] },
    'pos_dynamic-leader-id': { name: '팀장', menu: [{ id: 'expense', text: '인원관리', path: '/manpower/team-worker-detail' }] },
    'pos_custom-office': { name: '사무실', menu: [{ text: '신청 승인센터', path: '/office/request-center' }] },
    untouched: { name: '다른 메뉴', menu: [] },
  };
  const after = registerTeamWorkerMenu(before).config;
  assert.equal(before['pos_dynamic-leader-id'].menu[0].sub, undefined);
  assert.deepEqual(after.untouched, before.untouched);
  assert.deepEqual(after['pos_dynamic-leader-id'].menu[0].sub.map(row => row.text), ['인원현황', '신규 작업자 등록']);
  assert.equal(after['pos_dynamic-leader-id'].menu[0].sub[0].path, '/manpower/team-worker-detail');
  assert.equal(after['pos_dynamic-leader-id'].menu[0].path, undefined);
  assert.deepEqual(after['pos_custom-office'].menu[0], before['pos_custom-office'].menu[0]);
  assert.equal(after['pos_custom-office'].menu[1].path, '/manpower/team-worker-requests');
  // A second execution must not touch the existing item or create another row.
  assert.deepEqual(registerTeamWorkerMenu(after).config, after);
});
