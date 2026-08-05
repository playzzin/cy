import { getDelegateAccountHeader, type SupportLaborStatementExcelBlock } from './SupportPaymentExcelGenerator';

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
