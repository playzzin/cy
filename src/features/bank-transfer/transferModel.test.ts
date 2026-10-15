import * as XLSX from 'xlsx-js-style';
import { addTransferCandidates, applyMemoRule, buildTransferWorkbook, createTransferRow, getTransferExportCells, validateTransferRow } from './transferModel';
import { MAX_TRANSFER_ROWS } from './transferLimits';
import type { TransferCandidate, TransferRow } from './types';

const candidate = (overrides: Partial<TransferCandidate> = {}): TransferCandidate => ({
    id: 'account:fixture-worker', source: 'account', sourceId: 'fixture-worker',
    name: '샘플작업자', groupName: '샘플팀', category: 'worker', bankName: '국민은행',
    bankCode: '004', accountNumber: '001234567890', accountHolder: '샘플예금주',
    amount: 50000, period: '2026-10', detail: '테스트 데이터', ...overrides,
});
const row = (overrides: Partial<TransferRow> = {}): TransferRow => ({
    ...createTransferRow(candidate(), '샘플회사', '{이름} 급여'), ...overrides,
});

describe('송금 후보 선택', () => {
    it('원본의 미리보기 표시와 메모를 그대로 가져온다', () => {
        const source = candidate({ receiverDisplay: '기존표시', senderMemo: '기존메모' });
        expect(createTransferRow(source, '새표시', '{이름} 월세')).toMatchObject({ receiverDisplay: '기존표시', senderMemo: '기존메모' });
        expect(source).not.toHaveProperty('rowId');
    });

    it('기존 급여 페이지와 동일한 이름 치환 규칙을 적용한다', () => {
        expect(applyMemoRule('{이름} 급여', '샘플')).toBe('샘플 급여');
        expect(applyMemoRule(' 급여', '샘플')).toBe('샘플 급여');
        expect(applyMemoRule('', '샘플')).toBe('샘플');
        expect(applyMemoRule('고정메모', '샘플')).toBe('고정메모');
    });

    it('같은 후보를 재선택하거나 한 번에 중복 전달해도 기존 편집을 보존한다', () => {
        const selected = [row({ amount: 70000 })];
        const newCandidate = candidate({ id: 'account:fixture-company', sourceId: 'fixture-company', category: 'company' });
        const result = addTransferCandidates(selected, [candidate(), newCandidate, newCandidate], '샘플회사', '{이름}');
        expect(result.duplicateCount).toBe(2);
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toBe(selected[0]);
        expect(result.rows[0].amount).toBe(70000);
        expect(selected).toHaveLength(1);
    });

    it('같은 계좌라도 서로 다른 원천 항목은 별도로 선택할 수 있다', () => {
        const result = addTransferCandidates([], [candidate(), candidate({ id: 'payroll:fixture-worker', source: 'payroll' })], '', '');
        expect(result.rows).toHaveLength(2);
        expect(result.duplicateCount).toBe(0);
    });
});

describe('국민은행 엑셀 검증', () => {
    it('저장할 수 없는 행 수는 담기와 엑셀 생성에서도 동일하게 제한한다', () => {
        const candidates = Array.from({ length: MAX_TRANSFER_ROWS + 1 }, (_, i) => candidate({ id: `row-${i}` }));
        expect(() => addTransferCandidates([], candidates, '', '')).toThrow('최대 2,000건');
        expect(() => buildTransferWorkbook(candidates.map(item => createTransferRow(item, '', '')))).toThrow('최대 2,000건');
        expect(addTransferCandidates([], candidates.slice(0, MAX_TRANSFER_ROWS), '', '').rows).toHaveLength(MAX_TRANSFER_ROWS);
    });

    it('미리보기와 파일이 줄바꿈·탭·앞뒤 공백을 똑같이 정리한다', () => {
        const value = row({ bankCode: ' 004 ', accountNumber: ' 001-234-567890 ', receiverDisplay: ' 검증\n회사 ', senderMemo: ' 검증\t메모 ' });
        const cells = getTransferExportCells(value);
        expect(cells).toEqual(['004', '001-234-567890', 50000, '검증 회사', '검증 메모']);
        expect(XLSX.utils.sheet_to_json(buildTransferWorkbook([value]).Sheets['국민은행용'], { header: 1 })[1]).toEqual(cells);
    });
    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 금액 %s은 다운로드를 차단한다', (amount) => {
        expect(validateTransferRow(row({ amount }))).toContain('이체금액은 1원 이상의 정수로 입력해 주세요.');
        expect(() => buildTransferWorkbook([row({ amount })])).toThrow('송금 정보를 수정');
    });

    it.each(['', '4', '000', '999', '=004'])('잘못된 은행코드 %s은 다운로드를 차단한다', (bankCode) => {
        expect(() => buildTransferWorkbook([row({ bankCode })])).toThrow('은행코드');
    });

    it.each(['', '123', '00123x456789', '=123456789', '1'.repeat(21)])('잘못된 계좌번호 %s은 다운로드를 차단한다', (accountNumber) => {
        expect(() => buildTransferWorkbook([row({ accountNumber })])).toThrow('계좌번호');
    });

    it('예금주 누락, 빈 목록 및 중복 원천은 다운로드를 차단한다', () => {
        expect(() => buildTransferWorkbook([row({ accountHolder: ' ' })])).toThrow('예금주');
        expect(() => buildTransferWorkbook([])).toThrow('송금할 계좌');
        expect(() => buildTransferWorkbook([row(), row()])).toThrow('중복');
    });

    it('총액도 안전한 정수 범위를 벗어나면 다운로드를 차단한다', () => {
        expect(() => buildTransferWorkbook([row({ amount: Number.MAX_SAFE_INTEGER }), row({ id: 'second' })])).toThrow('총 이체금액');
    });

    it('기존 급여 파일의 A~E 순서와 선행 0을 저장 후 읽기에서도 보존한다', () => {
        const workbook = buildTransferWorkbook([row({ accountNumber: '001-234-567890' })]);
        const file = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const restored = XLSX.read(file, { type: 'array', cellNF: true });
        expect(restored.SheetNames).toEqual(['국민은행용']);
        const sheet = restored.Sheets['국민은행용'];
        expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })).toEqual([
            ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'],
            ['004', '001-234-567890', 50000, '샘플회사', '샘플작업자 급여'],
        ]);
        expect(sheet.A2).toMatchObject({ t: 's', v: '004', z: '@' });
        expect(sheet.B2).toMatchObject({ t: 's', v: '001-234-567890', z: '@' });
        expect(sheet.C2).toMatchObject({ t: 'n', v: 50000 });
    });

    it.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)'])('메모 %s을 실행 가능한 수식으로 저장하지 않는다', (memo) => {
        const workbook = buildTransferWorkbook([row({ senderMemo: memo, receiverDisplay: memo })]);
        const restored = XLSX.read(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }), { type: 'array' });
        const sheet = restored.Sheets['국민은행용'];
        ['D2', 'E2'].forEach((address) => {
            expect(sheet[address]).toMatchObject({ t: 's', v: memo });
            expect(sheet[address]).not.toHaveProperty('f');
        });
    });
});
