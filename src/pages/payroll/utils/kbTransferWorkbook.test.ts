import * as XLSX from 'xlsx-js-style';
import type { KBPreviewSnapshot, KBTransferRow } from '../MonthlyWageModel';
import { buildKBTransferWorkbook } from './kbTransferWorkbook';

const row = (overrides: Partial<KBTransferRow> = {}): KBTransferRow => ({
    sourceRowId: 'synthetic-worker-1', month: '2026-07', teamName: '검증팀',
    workerName: '검증작업자', salaryLabel: '월급제', bankName: '국민은행',
    bankCode: '004', bankCodeDisplay: '004', bankCodeUnmapped: false,
    bankCodeNeedsFix: false, bankCodeReason: '', bankCodeCandidates: '',
    accountNumber: '000123456789', accountHolder: '검증예금주', amount: 1068535,
    receiverDisplay: '검증급여', senderMemo: '검증작업자 정산',
    usesPrimaryAccount: false, validationErrors: [], ...overrides,
});

const snapshot = (rows: KBTransferRow[] = [row()]): KBPreviewSnapshot => ({
    createdAtIso: '2026-07-31T00:00:00.000Z', primaryAccount: null, sourceRows: [], rows,
    excludedRows: [], criteria: {
        generatedAt: '2026. 7. 31. 09:00', rangeLabel: '2026-07', teamLabel: '검증팀',
        targetLabel: '전체 작업자', salaryFilterLabel: '월급제', amountTypeLabel: '현재 화면 실지급액',
        deductionStatusLabel: '사업소득 적용', sourceCount: rows.length, exportCount: rows.length,
        excludedCount: 0, totalAmount: rows.reduce((sum, item) => sum + item.amount, 0),
    },
});

const auditRows = (workbook: XLSX.WorkBook): Array<Array<string | number>> => (
    XLSX.utils.sheet_to_json(workbook.Sheets['검증'], { header: 1 })
);

it('은행 업로드 열 순서와 계좌 앞자리 0, 숫자 금액 및 서식을 유지한다', () => {
    const workbook = buildKBTransferWorkbook(snapshot());
    const sheet = workbook.Sheets['국민은행용'];
    expect(workbook.SheetNames).toEqual(['국민은행용', '검증']);
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })).toEqual([
        ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'],
        ['004', '000123456789', 1068535, '검증급여', '검증작업자 정산'],
    ]);
    expect(sheet.A2).toMatchObject({ t: 's', z: '@', v: '004' });
    expect(sheet.B2).toMatchObject({ t: 's', z: '@', v: '000123456789' });
    expect(sheet.C2).toMatchObject({ t: 'n', s: { numFmt: '#,##0', fill: { fgColor: { rgb: 'C6EFCE' } } } });
    expect(sheet.A1.s).toMatchObject({ font: { bold: true }, fill: { fgColor: { rgb: 'FDE68A' } } });
    expect(sheet['!cols']).toEqual([{ wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 18 }]);
});

it('오류 행을 업로드에서 제외하고 검증 시트에 제외 사유와 정상 금액 합계를 남긴다', () => {
    const input = snapshot([
        row(), row({ sourceRowId: 'invalid', workerName: '오류작업자', amount: 500, validationErrors: ['bankCode', 'accountNumber'] }),
        row({ sourceRowId: 'valid-2', amount: 2000 }),
    ]);
    input.excludedRows = [{ sourceRowId: 'zero', month: '2026-07', teamName: '검증팀', workerName: '영원작업자', salaryLabel: '월급제', amount: 0, reason: '이체금액 없음' }];
    input.criteria.excludedCount = 1;
    const workbook = buildKBTransferWorkbook(input);
    expect(workbook.Sheets['국민은행용']['!ref']).toBe('A1:E3');
    expect(auditRows(workbook)).toEqual(expect.arrayContaining([
        ['다운로드 행', 2], ['검증 오류 제외', 1], ['기타 제외 행', 1], ['총 이체금액', 1070535],
        ['2026-07 검증팀 오류작업자', '검증 오류: 은행코드, 계좌번호', 500],
        ['2026-07 검증팀 영원작업자', '이체금액 없음', 0],
    ]));
});

it('검증 시트의 대표계좌 정보와 적용 인원을 미리보기 스냅샷에서 가져온다', () => {
    const input = snapshot([row({ usesPrimaryAccount: true }), row({ sourceRowId: 'worker-2' })]);
    input.primaryAccount = { sourceType: 'custom', sourceId: '', sourceName: '검증회사', bankName: '신한은행', accountNumber: '000987654321', accountHolder: '검증대표' };
    expect(auditRows(buildKBTransferWorkbook(input))).toEqual(expect.arrayContaining([
        ['적용 대표계좌', '검증회사 · 신한은행 · 000987654321 · (검증대표)'],
        ['대표계좌 적용 인원', 1], ['기간', '2026-07'], ['공제 적용 상태', '사업소득 적용'],
    ]));
});

it('표시 문구의 줄바꿈과 양끝 공백만 정리하고 수식처럼 보이는 문구도 문자열로 보존한다', () => {
    const workbook = buildKBTransferWorkbook(snapshot([row({ receiverDisplay: '  =검증\r\n급여  ', senderMemo: '\n검증\n정산 ' })]));
    expect(workbook.Sheets['국민은행용'].D2).toMatchObject({ t: 's', z: '@', v: '=검증 급여' });
    expect(workbook.Sheets['국민은행용'].D2.f).toBeUndefined();
    expect(workbook.Sheets['국민은행용'].E2.v).toBe('검증 정산');
});

it('XLSX로 직렬화한 후에도 긴 계좌번호와 정확한 금액이 유지된다', () => {
    const workbook = buildKBTransferWorkbook(snapshot([row({ accountNumber: '0001234567890123456789', amount: 987654321 })]));
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const restored = XLSX.read(bytes, { type: 'array' });
    expect(restored.Sheets['국민은행용'].B2).toMatchObject({ t: 's', v: '0001234567890123456789' });
    expect(restored.Sheets['국민은행용'].C2).toMatchObject({ t: 'n', v: 987654321 });
});

it.each([{ rows: [] }, { rows: [row({ validationErrors: ['accountHolder'] })] }])('정상 행이 없으면 계좌 업로드 행을 만들지 않는다 (%#)', ({ rows }) => {
    const workbook = buildKBTransferWorkbook(snapshot(rows));
    expect(workbook.Sheets['국민은행용']['!ref']).toBe('A1:E1');
    expect(auditRows(workbook)).toContainEqual(['총 이체금액', 0]);
});

it('출력 과정에서 원본 스냅샷과 입력 순서를 변경하지 않는다', () => {
    const input = snapshot([row({ amount: 300 }), row({ sourceRowId: 'second', amount: 100 })]);
    const before = JSON.parse(JSON.stringify(input));
    buildKBTransferWorkbook(input);
    expect(input).toEqual(before);
});
