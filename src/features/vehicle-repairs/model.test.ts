import * as XLSX from 'xlsx';
import { classifyRepairImport, emptyCosts, isValidRepairDate, matchRepairVehicles, parseRepairWorkbook, repairAmounts, repairTotal, sumRepairAmounts } from './model';

const book = (rows: unknown[][], sheet = '2026년') => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheet);
  return workbook;
};
const headers = ['날짜', '차량번호', '내역', '운전자', '개인', '청연(VAT포함)'];

test('양쪽 표의 정비만 가져오며 합계와 빈 서식을 제외하고 소수 금액을 보존한다', () => {
  const records = parseRepairWorkbook(book([
    [...headers, null, ...headers],
    ['2026-01-05', '12가 3456', '엔진오일', '', 0, 110000, null, '2026-07-02', '34나5678', '타이어', '', 50000, 100000.7],
    ['1월 총 수리비용', null, null, null, 0, 110000],
    [],
  ]), 'sample.xlsx');
  expect(records).toHaveLength(2);
  expect(records[0].costs).toEqual({ ...emptyCosts(), personal: 0, cheongyeon: 110000 });
  expect(records[1].source?.cell).toBe('H2');
  expect(repairTotal(records[1])).toBe(150000.7);
});

test('존재하지 않는 날짜를 임의 수정하거나 누락하지 않는다', () => {
  const [record] = parseRepairWorkbook(book([headers, ['02월 29일', '12가3456', '수리', '', null, 330000]]), 'sample.xlsx');
  expect(record.date).toBe('');
  expect(record.originalDate).toBe('02월 29일');
  expect(record.yearMonth).toBe('2026-02');
  expect(record.issues).toContain('날짜 확인 필요');
  expect(repairTotal(record)).toBe(330000);
  expect(isValidRepairDate('2024-02-29')).toBe(true);
  expect(isValidRepairDate('2026-02-29')).toBe(false);
});

test('연도별 법인 구분을 보존하며 금액 누락을 0과 구분한다', () => {
  const rows = [['날짜', '차량번호', '내역', '운전자', '개인', '법인'], ['2021-01-01', '12가3456', '수리', '', null, 10]];
  expect(parseRepairWorkbook(book(rows, '2021년(조은)'), 'a.xlsx')[0].costs.joeun).toBe(10);
  expect(parseRepairWorkbook(book(rows, '2021년(청연)'), 'a.xlsx')[0].costs.cheongyeon).toBe(10);
  expect(parseRepairWorkbook(book(rows, '2020년'), 'a.xlsx')[0].costs.corporate).toBe(10);
  const [missing] = parseRepairWorkbook(book([headers, ['2026-01-01', '12가3456', '수리']]), 'a.xlsx');
  expect(missing.issues).toContain('금액 확인 필요');
});

test('파일명 변경 재가져오기와 수정된 기존 기록을 중복 생성하지 않는다', () => {
  const workbook = book([headers, ['2026-01-01', '12가3456', '수리', '', null, 100]]);
  const source = parseRepairWorkbook(workbook, 'original.xlsx');
  const renamed = parseRepairWorkbook(workbook, 'renamed.xlsx');
  const existing = [{ ...source[0], description: '웹에서 수정', revision: 2 }];
  expect(classifyRepairImport(renamed, existing).duplicates).toHaveLength(1);
  const changed = [{ ...renamed[0], source: { ...renamed[0].source!, signature: 'changed' } }];
  expect(classifyRepairImport(changed, existing).conflicts).toHaveLength(1);
});

test('차량번호 전체가 유일하게 일치할 때만 연결한다', () => {
  const records = parseRepairWorkbook(book([headers, ['2026-01-01', '12가 3456', '수리', '', 0]]), 'a.xlsx');
  expect(matchRepairVehicles(records, [{ id: 'match', licensePlate: '12가3456' }])[0].vehicleId).toBe('match');
  expect(matchRepairVehicles(records, [{ id: 'wrong', licensePlate: '99가3456' }])[0].vehicleId).toBe('');
  expect(matchRepairVehicles(records, [{ id: 'a', licensePlate: '12가3456' }, { id: 'b', licensePlate: '12가3456' }])[0].vehicleId).toBe('');
});

test('개인에는 VAT를 더하지 않고 기존 법인 총액에서만 공급가액·VAT를 분리한다', () => {
  const costs = { personal: 50000, joeun: 11000, cheongyeon: 22000, corporate: 33000 };
  expect(repairAmounts({ costs })).toEqual({ personal: 50000, corporate: 60000, vat: 6000, total: 116000 });
  expect(costs).toEqual({ personal: 50000, joeun: 11000, cheongyeon: 22000, corporate: 33000 });
  expect(repairAmounts({ costs: { ...emptyCosts(), personal: 12345 } })).toEqual({ personal: 12345, corporate: null, vat: 0, total: 12345 });
});

test('원본의 소수 총액과 0원·미입력 상태를 보존하고 합계는 행별 VAT를 더한다', () => {
  const rows = [1, 1, 1].map(corporate => ({ costs: { ...emptyCosts(), corporate } }));
  expect(sumRepairAmounts(rows)).toEqual({ personal: 0, corporate: 2.73, vat: 0.27, total: 3 });
  expect(repairAmounts({ costs: { ...emptyCosts(), corporate: 100000.7 } })).toEqual({ personal: null, corporate: 90909.73, vat: 9090.97, total: 100000.7 });
  expect(repairAmounts({ costs: emptyCosts() })).toEqual({ personal: null, corporate: null, vat: 0, total: 0 });
  expect(repairAmounts({ costs: { ...emptyCosts(), corporate: 0 } }).corporate).toBe(0);
});
