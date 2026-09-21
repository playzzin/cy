const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerTeamExpenseMenu } = require('./register-team-expense-menu.cjs');
test('통합메뉴 직책 ID를 사용하고 기존 경비내역을 보존하며 재실행 시 중복하지 않는다', () => {
  const before = {
    admin: { positionConfig: [{ id: 'dynamic-leader-id', name: '팀장' }, { id: 'custom-office', name: '사무실' }], menu: [{ text: '운영 관리', sub: [] }] },
    'pos_dynamic-leader-id': { name: '팀장', menu: [{ id: 'expense', text: '경비관리', path: '/support/team-resource-detail' }] },
    'pos_custom-office': { name: '사무실', menu: [{ text: '신청 승인센터', path: '/office/request-center' }] },
    untouched: { name: '다른 메뉴', menu: [] },
  };
  const after = registerTeamExpenseMenu(before).config;
  assert.equal(before['pos_dynamic-leader-id'].menu[0].sub, undefined);
  assert.deepEqual(after.untouched, before.untouched);
  assert.deepEqual(after['pos_dynamic-leader-id'].menu[0].sub.map(row => row.text), ['경비내역', '경비입력']);
  assert.equal(after['pos_dynamic-leader-id'].menu[0].sub[0].path, '/support/team-resource-detail');
  assert.equal(after['pos_dynamic-leader-id'].menu[0].path, undefined);
  assert.deepEqual(after['pos_custom-office'].menu[0], before['pos_custom-office'].menu[0]);
  assert.equal(after['pos_custom-office'].menu[1].path, '/support/team-expense-requests');
  // A second execution must not touch the existing item or create another row.
  assert.deepEqual(registerTeamExpenseMenu(after).config, after);
});
