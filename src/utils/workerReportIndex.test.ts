import type { DailyReportWorkerRow } from '../services/dailyReportService';
import { getIndexedWorkerRows, indexWorkerReportRows } from './workerReportIndex';

const row = (reportId: string, workerId: string, workerName: string, overrides: Partial<DailyReportWorkerRow> = {}): DailyReportWorkerRow => ({
    reportId, workerId, workerName, date: '2026-10-01', teamId: 'team', teamName: '검증팀',
    siteId: 'site', siteName: '검증현장', role: undefined, status: 'attendance',
    manDay: 0.25, unitPrice: 100001, amount: 25000.25, payType: undefined,
    salaryModel: undefined, workContent: undefined, siteType: '', paymentType: '', createdAt: null,
    ...overrides,
});

test('현재 ID, 이전 ID, ID 없는 이름 행을 입력 순서로 합치며 다른 ID의 동명이인은 제외한다', () => {
    const rows = [
        row('name-first', '', ' Test Worker '),
        row('old-id', 'old-worker', '이전 이름'),
        row('same-name-other-id', 'other-worker', 'TestWorker'),
        row('current-id', 'worker', '새 이름'),
        row('name-last', '  ', 'test\tworker'),
    ];
    const result = getIndexedWorkerRows(indexWorkerReportRows(rows), {
        id: ' worker ', legacyId: ' old-worker ', name: 'TEST WORKER',
    });
    expect(result).toEqual([rows[0], rows[1], rows[3], rows[4]]);
});

test('현재 ID와 이전 ID가 같아도 같은 버킷을 두 번 반환하지 않는다', () => {
    const rows = [row('first', 'worker', '검증'), row('second', 'worker', '검증'), row('legacy', '', '검증')];
    expect(getIndexedWorkerRows(indexWorkerReportRows(rows), {
        id: 'worker', legacyId: ' worker ', name: '검증',
    })).toEqual(rows);
});

test('ID가 없는 작업자는 이름이 맞는 ID 없는 행만 조회한다', () => {
    const rows = [row('named-id', 'worker', '검증 이름'), row('legacy-name', '', ' 검증\n이름 ')];
    expect(getIndexedWorkerRows(indexWorkerReportRows(rows), { name: '검증이름' })).toEqual([rows[1]]);
});

test('빈 ID와 이름은 서로 매칭하지 않고 이름이 비어도 일치하는 ID는 조회한다', () => {
    const rows = [row('empty', '', ''), row('whitespace', ' ', '\n\t '), row('id-only', 'worker', '')];
    const index = indexWorkerReportRows(rows);
    expect(getIndexedWorkerRows(index, { id: '', legacyId: undefined, name: '  ' })).toEqual([]);
    expect(getIndexedWorkerRows(index, { id: 'missing', name: '' })).toEqual([]);
    expect(getIndexedWorkerRows(index, { id: 'worker', name: '' })).toEqual([rows[2]]);
    expect(getIndexedWorkerRows(indexWorkerReportRows([]), { name: '검증' })).toEqual([]);
});

test('이전 ID만 있는 작업자도 조회하며 ID 대소문자는 구분한다', () => {
    const rows = [row('upper', 'Worker', '다름'), row('lower', 'worker', '다름')];
    expect(getIndexedWorkerRows(indexWorkerReportRows(rows), { legacyId: 'Worker', name: '검증' })).toEqual([rows[0]]);
});

test('원본 행과 배열을 변경하지 않고 소수 공수와 금액, 같은 참조의 반복 행도 보존한다', () => {
    const first = Object.freeze(row('first', 'worker', '검증'));
    const last = Object.freeze(row('last', '', '검증', { manDay: 1.125, amount: 112501.125 }));
    const rows = Object.freeze([first, first, last]);
    const index = indexWorkerReportRows(rows);
    const worker = { id: 'worker', name: '검증' };
    const result = getIndexedWorkerRows(index, worker);
    expect(result).toEqual(rows);
    expect(result[0]).toBe(first);
    expect(result[2]).toBe(last);
    expect(result.map(entry => entry.manDay)).toEqual([0.25, 0.25, 1.125]);
    expect(result.map(entry => entry.amount)).toEqual([25000.25, 25000.25, 112501.125]);
    result.reverse();
    expect(getIndexedWorkerRows(index, worker)).toEqual(rows);
    expect(rows).toEqual([first, first, last]);
});
