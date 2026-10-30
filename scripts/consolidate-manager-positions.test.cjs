const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('./consolidate-manager-positions.cjs');

const record = (path, data) => ({ path, data });
const fixture = () => [
  record('positions/default_first', { name: '매니저1', rank: 2, systemRole: '매니저' }),
  record('positions/second', { name: '매니저2', legacyId: 'old-second', rank: 3 }),
  record('positions/third', { name: '매니저3', rank: 4 }),
  record('positions/leader', { name: '팀장', rank: 5 }),
  record('settings/menus_v12', {
    admin: { name: 'ERP', menu: [{ text: '허용', roles: ['매니저1', '매니저2', '팀장'] }], positionConfig: [
      { id: 'old-first', name: '매니저1', order: 1 },
      { id: 'old-second', name: '매니저2', order: 2 },
      { id: 'old-third', name: '매니저3', order: 3 },
      { id: 'leader', name: '팀장', order: 4 },
    ] },
    'pos_old-first': { name: '매니저1', icon: 'tie', menu: [{ id: 'first', text: '업무', sub: [{ text: '일보', path: '/reports', roles: ['매니저1'] }] }] },
    'pos_old-second': { name: '매니저2', menu: [{ id: 'other', text: '업무', sub: [{ text: '일보', path: '/reports', roles: ['매니저2'] }, { text: '정산', path: '/settlement' }] }] },
    'pos_old-third': { name: '매니저3', menu: [], headerActions: [{ text: '할일', path: '/todo' }] },
    pos_leader: { name: '팀장', menu: [{ text: '팀 일보', path: '/team' }] },
  }),
  record('users/admin-user', { role: 'admin', position: '매니저2', additionalPositions: ['매니저1', '지원담당'] }),
  record('users/general-user', { role: 'user', position: '매니저3' }),
  record('users/leader', { role: 'user', position: '팀장' }),
  record('office_staff/staff', { role: '매니저1', uid: 'linked-user' }),
  record('workers/worker', { role: '매니저2', positionId: 'second', menuPositionId: 'old-second' }),
  record('system_configs/user_menu_positions', { data: JSON.stringify({ 'extra-user': ['매니저1', '매니저2', 'DEV'], leader: ['팀장'] }) }),
  record('system_configs/permissions', { data: JSON.stringify({ 매니저1: { reports: true, finance: false }, 매니저2: { reports: false, finance: true }, 팀장: { reports: true } }) }),
];
function apply(records, operations) {
  const result = structuredClone(records);
  for (const operation of operations) {
    const index = result.findIndex(record => record.path === operation.path);
    if (operation.type === 'delete') result.splice(index, 1);
    else result[index].data = operation.type === 'set' ? operation.data : { ...result[index].data, ...operation.patch };
  }
  return result;
}

test('통합은 메뉴 합집합, 사용자 등급, 기타 직책을 보존하고 모든 연결을 옮긴다', () => {
  const before = fixture();
  const original = structuredClone(before);
  const plan = buildPlan(before);
  assert.deepEqual(before, original, '원본을 변경하면 안 된다');
  const after = new Map(apply(before, plan.operations).map(record => [record.path, record.data]));
  const menu = after.get('settings/menus_v12');
  assert.deepEqual(menu.admin.positionConfig.map(p => p.name), ['매니저', '팀장']);
  assert.deepEqual(menu.pos_manager.menu[0].sub.map(p => p.path), ['/reports', '/settlement']);
  assert.deepEqual(menu.pos_manager.menu[0].sub[0].roles, ['매니저']);
  assert.deepEqual(menu.admin.menu[0].roles, ['매니저', '팀장']);
  assert.equal(menu.pos_manager.headerActions[0].path, '/todo');
  assert.equal(menu['pos_old-second'], undefined);
  assert.equal(after.get('users/admin-user').role, 'admin');
  assert.equal(after.get('users/general-user').role, 'user');
  assert.equal(after.get('users/general-user').position, '매니저');
  assert.deepEqual(after.get('users/admin-user').additionalPositions, ['지원담당']);
  assert.deepEqual(after.get('users/leader'), original.find(r => r.path === 'users/leader').data);
  assert.deepEqual(menu.pos_leader, original.find(r => r.path === 'settings/menus_v12').data.pos_leader);
  assert.equal(after.get('workers/worker').positionId, 'default_first');
  assert.equal(after.get('workers/worker').menuPositionId, 'manager');
  assert.deepEqual(JSON.parse(after.get('system_configs/user_menu_positions').data)['extra-user'], ['매니저', 'DEV']);
  assert.deepEqual(JSON.parse(after.get('system_configs/permissions').data).매니저, { reports: true, finance: true });
  assert.ok(plan.changedUserIds.includes('linked-user'));
  assert.ok(plan.changedUserIds.includes('extra-user'));
});

test('재실행하면 변경이 없고 오래된 직책을 재생성하지 않는다', () => {
  const before = fixture();
  const after = apply(before, buildPlan(before).operations);
  assert.deepEqual(buildPlan(after).operations, []);
});

test('메뉴 설정이 없거나 손상된 추가 직책 설정은 쓰기 전에 중단한다', () => {
  assert.throws(() => buildPlan([]), /메뉴 설정/);
  const records = fixture();
  records.find(r => r.path === 'system_configs/user_menu_positions').data.data = '{broken';
  assert.throws(() => buildPlan(records));
});
