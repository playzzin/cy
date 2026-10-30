import * as XLSX from 'xlsx-js-style';
import { buildAdvanceSummary } from './advanceSummary';
import { buildAdvanceKBSnapshot, getAdvanceKBFileName, type AdvanceKBExportSource } from './advanceSummaryKBExport';
import { buildKBTransferWorkbook } from './kbTransferWorkbook';
import type { AdvanceRequest } from '../../../services/advanceRequestService';

const teams = [{ id: 'a', name: '검증팀', color: '#2563eb' }, { id: 'b', name: '다른팀' }];
const workers = [
    { id: 'worker', name: '검증 작업자', bankName: 'KB국민은행', accountNumber: '000-1234-5678', accountHolder: '검증 예금주' },
    { id: 'other-worker', name: '다른 작업자', bankName: '미등록은행', accountNumber: '', accountHolder: '' },
];
const request = (overrides: Partial<AdvanceRequest>): AdvanceRequest => ({
    id: 'first', workerId: 'worker', workerName: '검증 작업자', teamId: 'a', yearMonth: '2026-10',
    category: 'first', status: 'requested', requestedAmount: 100000, ...overrides,
} as AdvanceRequest);
const requests = [request({}), request({ id: 'second', category: 'second', requestedAmount: 50000 }),
    request({ id: 'manual', source: 'manual-prepayment', category: 'other', status: 'paid', requestedAmount: 20000 }),
    request({ id: 'cancelled', status: 'cancelled', requestedAmount: 900000 }),
    request({ id: 'rejected', status: 'rejected', requestedAmount: 800000 }),
    request({ id: 'old', yearMonth: '2026-09', requestedAmount: 700000 }),
    request({ id: 'other', workerId: 'other-worker', workerName: '다른 작업자', teamId: 'b', requestedAmount: 30000 })];
const source = (overrides: Partial<AdvanceKBExportSource> = {}): AdvanceKBExportSource => ({
    groups: buildAdvanceSummary(requests, teams, { yearMonth: '2026-10', teamId: '', item: 'all', query: '' }, workers).groups,
    yearMonth: '2026-10', teamLabel: '전체 팀', categoryLabel: '전체 신청', query: '', createdAtIso: '2026-10-30T00:00:00.000Z', ...overrides,
});

test('조회한 신청 금액을 합산하고 취소·반려·다른 월을 제외하며 팀·회차·검색 범위를 유지한다', () => {
    const all = buildAdvanceKBSnapshot(source(), '검증가불', '{이름} 가불');
    expect(all.rows.map(row => row.amount).sort((a, b) => a - b)).toEqual([30000, 170000]);
    const filtered = source({ groups: buildAdvanceSummary(requests, teams, { yearMonth: '2026-10', teamId: 'a', item: 'second', query: '검증' }, workers).groups,
        teamLabel: '검증팀', categoryLabel: '2회차', query: '검증' });
    const preview = buildAdvanceKBSnapshot(filtered, '검증가불', '{이름} 2회차');
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({ amount: 50000, bankCode: '004', accountNumber: '00012345678', senderMemo: '검증 작업자 2회차' });
    expect(preview.criteria).toMatchObject({ targetLabel: '검증팀 · 검색: 검증', salaryFilterLabel: '2회차', totalAmount: 50000 });
});

test('계좌 오류는 국민은행 시트에서 제외하고 검증 시트에 사유와 합계를 기록한다', () => {
    const preview = buildAdvanceKBSnapshot(source(), '검증가불', '{이름} 가불');
    const workbook = buildKBTransferWorkbook(preview);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['국민은행용'], { header: 1 })).toEqual([
        ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'],
        ['004', '00012345678', 170000, '검증가불', '검증 작업자 가불'],
    ]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['검증'], { header: 1 })).toEqual(expect.arrayContaining([
        ['총 이체금액', 170000], ['검증 오류 제외', 1], ['2026-10 다른팀 다른 작업자', '검증 오류: 은행코드, 계좌번호', 30000],
    ]));
});

test('숫자가 아닌 계좌와 알 수 없는 은행코드, 안전 범위를 넘는 금액은 다운로드 대상이 아니다', () => {
    const input = source();
    input.groups[0].rows[0] = { ...input.groups[0].rows[0], bankName: '999', accountNumber: '12가34', amount: Number.MAX_SAFE_INTEGER + 1 };
    const row = buildAdvanceKBSnapshot(input, '', '').rows[0];
    expect(row.validationErrors).toEqual(expect.arrayContaining(['bankCode', 'accountNumber', 'amount']));
});

test('실제 XLSX 직렬화 후에도 앞자리 0·긴 계좌·금액·문자열을 보존하고 원본을 바꾸지 않는다', () => {
    const input = source();
    const group = input.groups.find(group => group.team.id === 'a')!;
    group.rows[0] = { ...group.rows[0], accountNumber: '0001234567890123456789' };
    const original = JSON.stringify(input);
    const preview = buildAdvanceKBSnapshot(input, ' =검증\n가불 ', '{이름} 2회차');
    const workbook = buildKBTransferWorkbook(preview);
    const restored = XLSX.read(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    expect(restored.Sheets['국민은행용'].A2).toMatchObject({ t: 's', v: '004' });
    expect(restored.Sheets['국민은행용'].B2).toMatchObject({ t: 's', v: '0001234567890123456789' });
    expect(restored.Sheets['국민은행용'].C2).toMatchObject({ t: 'n', v: 170000 });
    expect(restored.Sheets['국민은행용'].D2).toMatchObject({ t: 's', v: '=검증 가불' });
    expect(restored.Sheets['국민은행용'].D2.f).toBeUndefined();
    expect(JSON.stringify(input)).toBe(original);
    expect(getAdvanceKBFileName({ ...input, teamLabel: 'A/B:팀' })).toBe('팀별가불내역_국민은행용_2026-10_A_B_팀_전체 신청.xlsx');
});
