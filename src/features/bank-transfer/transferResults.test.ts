import { createTransferRow } from './transferModel';
import { matchTransferResults, mergeTransferResults, readTransferResultFile } from './transferResults';
import { createExportRecord } from './transferWorkflow';
const row = createTransferRow({ id: 'test', sourceId: 'test', source: 'account', category: 'worker', name: '가상작업자', groupName: '가상팀', bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '가상작업자', amount: 1000, period: '', detail: '' }, '가상', '{이름}');
const columns = { bank: 0, account: 1, amount: 2, status: 3, note: 4 };
const line = ['004', '00123456789', '1,000', '성공', '검증'];
const match = (lines: string[][], rows = [row]) => matchTransferResults(lines, columns, rows, '성공,이체완료', '실패');
beforeEach(() => Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'file1' } }));

it('은행·문자열 계좌·정수 금액이 모두 일치할 때만 결과를 연결한다', () => {
    expect(match([line])[0].result).toMatchObject({ rowId: row.rowId, status: 'success', note: '검증' });
    expect(match([['KB국민은행', ...line.slice(1)]])[0].result?.status).toBe('success');
    expect(match([['국민 추정', ...line.slice(1)]])[0].result).toBeUndefined();
    for (const changed of [['020', ...line.slice(1)], ['004', '123456789', ...line.slice(2)], ['004', line[1], '2000', '성공']]) expect(match([changed])[0].result).toBeUndefined();
});
it('미확인 결과와 부분 일치 문구를 성공으로 추측하지 않는다', () => {
    expect(match([['004', line[1], '1000', '성공 예정']])[0].result).toBeUndefined();
    expect(match([['004', line[1], '1000', '실패']])[0].result?.status).toBe('failed');
});
it('목록이나 결과 파일에 동일 계좌·금액이 중복되면 자동 연결하지 않는다', () => {
    expect(match([line], [row, { ...row, rowId: 'other', id: 'other' }])[0].result).toBeUndefined();
    expect(match([line, ['004', line[1], '1000', '실패']]).every(item => !item.result)).toBe(true);
    expect(match([line, ['004', line[1], '1000', '처리중']]).every(item => !item.result)).toBe(true);
});
it('열 중복과 겹치는 결과 표시를 거부한다', () => {
    expect(() => matchTransferResults([line], { ...columns, status: 2 }, [row], '성공', '실패')).toThrow('다르게');
    expect(() => matchTransferResults([line], columns, [row], '정상', '정상')).toThrow('겹치면');
});
it('선택한 결과만 병합하고 파일 당시 목록에 없는 결과를 거부한다', () => {
    const record = createExportRecord([row, { ...row, id: 'b', rowId: 'b' }], '검증.xlsx', '2026-10-15T00:00:00Z');
    record.results = [{ rowId: 'b', status: 'failed', note: '은행 확인' }];
    const results = mergeTransferResults(record, [{ rowId: row.rowId, status: 'success', note: '확인' }]);
    expect(results).toHaveLength(2); expect(record.results).toHaveLength(1);
    expect(() => mergeTransferResults(record, [{ rowId: 'missing', status: 'success', note: '' }])).toThrow('일치하지');
});
it('큰 파일과 지원하지 않는 파일은 읽기 전에 거부한다', async () => {
    await expect(readTransferResultFile(new File(['test'], 'test.txt'))).rejects.toThrow('엑셀');
    const large = new File(['test'], 'test.xlsx'); Object.defineProperty(large, 'size', { value: 5_000_001 });
    await expect(readTransferResultFile(large)).rejects.toThrow('5MB');
});
