import { repairLedgerExpenses } from './expenses';
import { emptyCosts, RepairRecord } from './model';

const row: RepairRecord = { id: 'r1', date: '2026-10-05', yearMonth: '2026-10', originalDate: '',
  vehicleId: '', vehiclePlate: '12가 3456', description: '수리', driver: '', vendor: '',
  costs: { ...emptyCosts(), personal: 10000, cheongyeon: 22000 }, memo: '', issues: [], archived: false, revision: 1 };
const vehicles = [{ id: 'v1', licensePlate: '12가3456' }];
test('저장한 정비비는 연결 차량의 해당 월 수리비로 한 번 반영한다', () => {
  expect(repairLedgerExpenses([row], vehicles, '2026-10')).toEqual([expect.objectContaining({
    id: 'repair-ledger-source:r1', vehicleId: 'v1', amount: 32000, date: '2026-10-05', type: 'REPAIR'
  })]);
  expect(repairLedgerExpenses([row], vehicles, '2026-09')).toEqual([]);
});
test('삭제·미연결·중복 차량·잘못된 날짜와 금액은 합산하지 않는다', () => {
  expect(repairLedgerExpenses([{ ...row, archived: true }, { ...row, date: '2026-10-32' },
    { ...row, costs: { ...emptyCosts(), personal: -10 } }], vehicles, '2026-10')).toEqual([]);
  expect(repairLedgerExpenses([row], [], '2026-10')).toEqual([]);
  expect(repairLedgerExpenses([row], [...vehicles, { ...vehicles[0], id: 'v2' }], '2026-10')).toEqual([]);
});
test('수정·복원은 원본의 최신 금액을 반영한다', () => {
  expect(repairLedgerExpenses([{ ...row, costs: { ...emptyCosts(), personal: 10.7 } }], vehicles, '2026-10')[0].amount).toBe(10.7);
});
test('기존 월별 수리비와 겹치는 엑셀 이관이력은 다시 합산하지 않는다', () => {
  const imported = { ...row, source: { fileName: 'history.xlsx', sheet: '2026', cell: 'A2', signature: 'history', costHeaders: ['청연'] } };
  expect(repairLedgerExpenses([imported, { ...row, id: 'new' }], vehicles, '2026-10')).toEqual([expect.objectContaining({ id: 'repair-ledger-source:new', amount: 32000 })]);
});
