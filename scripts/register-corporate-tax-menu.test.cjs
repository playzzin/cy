const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerCorporateTaxMenu, PATH } = require('./register-corporate-tax-menu.cjs');
const fixture = () => ({ admin: { name: '전체 메뉴', menu: [{ id: 'tax', text: '세무 관리', sub: [
  { id: 'ledger', text: '매입매출 관리', path: '/payroll/workbook-ledger', roles: ['admin'], hide: true },
  { id: 'other', text: '프리랜서 관리', path: '/manpower/freelancer' }
] }], headerActions: [{ id: 'header', text: '상단 메뉴' }] }, pos_worker: { name: '작업자', menu: [{ text: '작업자 메뉴' }] } });

test('기존 메뉴와 설정은 그대로 두고 매입매출 다음에 한 항목만 추가한다', () => {
  const before = fixture();
  const untouched = structuredClone(before);
  const { config, changes } = registerCorporateTaxMenu(before);
  assert.equal(changes.length, 1);
  const entry = config.admin.menu[0].sub.splice(1, 1)[0];
  assert.equal(entry.path, PATH);
  assert.deepEqual(entry.roles, ['admin']);
  assert.equal(entry.hide, true);
  assert.deepEqual(config, before);
  assert.deepEqual(before, untouched);
});
test('재실행해도 중복 메뉴를 추가하지 않는다', () => {
  const first = registerCorporateTaxMenu(fixture());
  const second = registerCorporateTaxMenu(first.config);
  assert.deepEqual(second.config, first.config);
  assert.equal(second.changes.length, 0);
});
test('중첩된 세무 관리와 폴더의 기존 접근 범위를 유지한다', () => {
  const before = { dev: { name: 'DEV', menu: [{ text: '공통메뉴', sub: [{ text: '세무관리', roles: ['manager'], hide: true, sub: [] }] }] } };
  const next = registerCorporateTaxMenu(before);
  assert.equal(next.changes[0].parent, '공통메뉴 → 세무관리');
  assert.deepEqual(next.changes[0].entry.roles, ['manager']);
  assert.equal(next.changes[0].entry.hide, true);
});
test('다른 위치의 기존 법인세 메뉴는 중복 생성하거나 이동하지 않는다', () => {
  const before = fixture();
  before.admin.menu.push({ text: '법인세 관리', path: PATH });
  assert.throws(() => registerCorporateTaxMenu(before), /위치 또는 경로/);
});
test('메뉴 ID 충돌과 모호한 세무 폴더는 저장 전에 중단한다', () => {
  const before = fixture();
  before.admin.menu.push({ id: 'corporate-tax', text: '다른 메뉴' });
  assert.throws(() => registerCorporateTaxMenu(before), /ID/);
  before.admin.menu.pop();
  before.admin.menu.push({ text: '세무관리', sub: [] });
  assert.throws(() => registerCorporateTaxMenu(before), /여러 개/);
});
