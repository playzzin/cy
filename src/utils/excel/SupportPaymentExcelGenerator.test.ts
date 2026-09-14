import {
    buildLaborStatementWorkbook,
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND,
    getDelegateAccountHeader,
    type SupportLaborStatementExcelBlock,
} from './SupportPaymentExcelGenerator';

const buildStatement = (overrides: Partial<SupportLaborStatementExcelBlock> = {}): SupportLaborStatementExcelBlock => ({
    siteName: '테스트 현장',
    settlementName: '테스트 정산처',
    direction: '외부지원간곳',
    rows: [],
    ...overrides
});

describe('getDelegateAccountHeader', () => {
    it('위임 행이 없어도 정산처 대표 계좌의 예금주를 머리글에 표시한다', () => {
        expect(getDelegateAccountHeader(buildStatement({
            delegateBankName: '국민은행',
            delegateAccountNumber: '123-456-7890',
            delegateAccountHolder: '홍길동'
        }))).toBe('위임계좌번호: 국민은행 123-456-7890 예금주 홍길동');
    });

    it('위임 지급 행이 있으면 해당 행의 계좌 정보를 우선 표시한다', () => {
        expect(getDelegateAccountHeader(buildStatement({
            delegateBankName: '국민은행',
            delegateAccountNumber: '111-111',
            delegateAccountHolder: '대표 예금주',
            rows: [{
                workerName: '작업자',
                bankName: '신한은행',
                accountNumber: '222-222',
                accountHolder: '위임 예금주',
                payType: 'delegate',
                days: [],
                totalManDay: 0,
                unitPrice: 0,
                totalAmount: 0,
                billingUnitPrice: 0,
                billingAmount: 0,
                vatAmount: 0,
                issuedAmount: 0
            }]
        }))).toBe('위임계좌번호: 신한은행 222-222 예금주 위임 예금주');
    });
});

describe('노임명세서 2줄 날짜/계좌 출력', () => {
    it('1~16일과 17~31일을 각각의 라인으로 나눈다', () => {
        expect(DAY_LABELS_FIRST).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
        expect(DAY_LABELS_SECOND).toEqual(Array.from({ length: 15 }, (_, index) => index + 17));
    });

    it('엑셀에도 날짜 라인 색상과 위임 계좌 전체 강조를 적용한다', () => {
        const days = Array.from({ length: 31 }, (_, index) => index + 1);
        const workbook = buildLaborStatementWorkbook([
            buildStatement({
                rows: [
                    {
                        workerName: '위임 작업자',
                        bankName: '국민은행',
                        accountNumber: '123-456',
                        accountHolder: '홍길동',
                        payType: 'delegate',
                        days,
                        totalManDay: 31,
                        unitPrice: 100000,
                        totalAmount: 3100000,
                        billingUnitPrice: 100000,
                        billingAmount: 3100000,
                        vatAmount: 0,
                        issuedAmount: 3100000,
                    },
                ],
            }),
        ], '2026-09');
        const worksheet = workbook.worksheets[0];

        expect(worksheet.getCell('E3').value).toBe('01');
        expect(worksheet.getCell('T3').value).toBe('16');
        expect(worksheet.getCell('E4').value).toBe('17');
        expect(worksheet.getCell('S4').value).toBe('31');
        expect(worksheet.getCell('T4').value).toBe('');
        expect((worksheet.getCell('E3').fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe('FFE0F2FE');
        expect((worksheet.getCell('E4').fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe('FFFFF1F2');
        expect(worksheet.getCell('X3').value).toBe('계좌번호 / 지급구분');
        expect(String(worksheet.getCell('X5').value)).toContain('위임');
        expect(String(worksheet.getCell('X5').value)).toContain('국민은행 / 홍길동 / 123-456');
        expect((worksheet.getCell('X5').fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe('FFFEF3C7');
    });
});
