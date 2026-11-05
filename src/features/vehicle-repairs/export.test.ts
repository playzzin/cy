import { buildRepairCsv } from './export';
import { emptyCosts, RepairRecord } from './model';

test('내보내기도 개인·법인·VAT·합계 순서로 원본 총액을 보존하고 수식을 이스케이프한다', () => {
  const row: RepairRecord = { id: 'qa', date: '2026-11-01', yearMonth: '2026-11', originalDate: '', vehicleId: '', vehiclePlate: '12가3456',
    description: '=1+1', driver: '', vendor: '검증 정비소', costs: { ...emptyCosts(), personal: 25000, joeun: 11000, cheongyeon: 22000, corporate: 33000 },
    memo: '검토,"완료"', issues: [], archived: false, revision: 1 };
  const csv = buildRepairCsv([row]);
  expect(csv.split('\r\n')[0]).toContain('"개인","법인","VAT","합계"');
  expect(csv.split('\r\n')[0]).not.toMatch(/조은|청연|미구분/);
  expect(csv).toContain('"25000","60000","6000","91000"');
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"검토,""완료"""');
});
