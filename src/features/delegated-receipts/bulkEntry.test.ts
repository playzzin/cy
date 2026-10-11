import { buildBulkClaims, BulkEntryRow, entryAmounts, parseEntryMoney, pasteEntryAmounts } from './bulkEntry';
import { getDepositState } from './depositState';

const directory = { teams: [], sites: [{ id: 's1', name: '가상 현장' }, { id: 's2', name: '다른 현장' }], workers: [{ id: 'w1', name: '동명이인' }, { id: 'w2', name: '동명이인' }] };
const row = (patch: Partial<BulkEntryRow> = {}): BulkEntryRow => ({ id: 'r1', siteId: 's1', workerId: 'w1', gross: '', expected: '', taxRate: '', delegation: 'delegate', recipient: 'personal', status: 'unknown', memo: '', ...patch });
const build = (rows: BulkEntryRow[]) => buildBulkClaims(rows, '2026-10', directory, 'batch-1', '2026-10-12T00:00:00Z');

it('엑셀의 금액 2열 붙여넣기는 여러 행을 한 번에 채우고 직접 예정액을 보존한다', () => {
  const rows = [row({ taxRate: '3.3' }), row({ id: 'r2', workerId: 'w2', taxRate: '3.3' })];
  const pasted = pasteEntryAmounts(rows, 0, 'gross', '1,000,000\t950,000\r\n0\t0\r\n');
  expect(pasted[0]).toMatchObject({ gross: '1,000,000', expected: '950,000', taxRate: '' });
  expect(pasted[1]).toMatchObject({ gross: '0', expected: '0', taxRate: '' });
  expect(rows[0].gross).toBe('');
  expect(pasteEntryAmounts(rows, 0, 'gross', '100\n200')[1].taxRate).toBe('3.3');
  expect(() => pasteEntryAmounts(rows, 1, 'gross', '100\n200')).toThrow('행이 부족');
  expect(() => pasteEntryAmounts(rows, 0, 'expected', '100\t200')).toThrow('1열');
  expect(() => pasteEntryAmounts(rows, 0, 'gross', '100\n-1')).toThrow('금액');
});

it('동명이인을 ID로 연결하고 개인통장을 입금완료로 추정하지 않는다', () => {
  const claims = build([row(), row({ id: 'r2', workerId: 'w2', status: 'complete' })]);
  expect(claims.map(claim => claim.workerId)).toEqual(['w1', 'w2']);
  expect(getDepositState(claims[0]).status).toBe('unknown');
  expect(getDepositState(claims[1]).status).toBe('complete');
  expect(claims.every(claim => claim.receipts.length === 0)).toBe(true);
  expect(claims[0].grossAmount).toBeNull();
});
it('원 단위 계산, 0% 세율, 직접 입력과 미확정을 구분한다', () => {
  expect(entryAmounts(row({ gross: '1,000,010', taxRate: '3.3' }))).toMatchObject({ grossAmount: 1000010, expectedAmount: 967010, taxAmount: 33000, taxRate: 3.3 });
  expect(entryAmounts(row({ gross: '0', taxRate: '0' }))).toMatchObject({ expectedAmount: 0, taxAmount: 0, taxRate: 0 });
  expect(entryAmounts(row({ expected: '0' }))).toMatchObject({ grossAmount: null, expectedAmount: 0, taxRate: null });
  expect(entryAmounts(row({ taxRate: '3.3' }))).toMatchObject({ grossAmount: null, expectedAmount: null, taxRate: 3.3 });
});
it.each(['1,2', '-1', '1.5', '1e5', 'Infinity', '9007199254740992'])('잘못된 금액 %s를 거부한다', value => expect(() => parseEntryMoney(value)).toThrow());
it.each(['-1', '101', '세금', '1e1'])('잘못된 세율 %s를 거부한다', taxRate => expect(() => entryAmounts(row({ taxRate }))).toThrow('세율'));
it('중복 행과 미등록 현장을 행 번호와 함께 알린다', () => {
  expect(() => build([row(), row({ id: 'r2' })])).toThrow('2행: 같은 현장');
  expect(() => build([row({ siteId: 'missing' })])).toThrow('1행: 등록된 현장');
  expect(build([row(), row({ id: 'r2', siteId: 's2' })])).toHaveLength(2);
});
it('잘못된 월과 행 수를 저장 전에 거부한다', () => {
  expect(() => build([])).toThrow('1~100행');
  expect(() => build(Array.from({ length: 101 }, () => row()))).toThrow('1~100행');
  expect(() => buildBulkClaims([row()], '2026-13', directory, 'b', '')).toThrow('귀속월');
});
