import { buildPayrollTransferDetail, isPayrollTransferDetail } from './payrollTransferDetail';

const options = { salaryLabel: '일급제', amountBasis: '노무가불 2', originalAmount: 20000, isFinalized: false };

it('계산된 근무·공제 내역만 복사하고 개인정보와 계좌를 포함하지 않는다', () => {
    const detail = buildPayrollTransferDetail({
        grossAmount: 100000, totalDeduction: 13300, totalAmount: 86700, totalManDay: 0.5, unitPrice: 200000,
        idNumber: 'fixture-identity', accountNumber: 'fixture-account',
        deductionBreakdown: { standardLines: [{ label: '가불', amount: 10000, description: '전월 이월', secret: 'fixture' }] },
        taxBreakdown: { standardLines: [{ label: '사업소득세', amount: 3300 }] },
        workEntries: [{ date: '2026-10-01', siteName: '검증현장', siteId: 'not-needed', manDay: 0.5, unitPrice: 200000, amount: 100000 }],
    }, options);
    expect(detail).toMatchObject({ ...options, grossAmount: 100000, totalDeduction: 13300, netAmount: 86700,
        workEntries: [{ date: '2026-10-01', siteName: '검증현장', manDay: 0.5, unitPrice: 200000, amount: 100000 }],
        deductions: [{ label: '가불', amount: 10000, description: '전월 이월' }], taxes: [{ label: '사업소득세', amount: 3300 }],
    });
    expect(JSON.stringify(detail)).not.toMatch(/fixture-identity|fixture-account|not-needed|secret/);
    expect(isPayrollTransferDetail(detail)).toBe(true);
});

it('이전 저장본에 없는 상세 금액을 0원으로 꾸미지 않으며 잘못된 상세 형식은 거부한다', () => {
    const detail = buildPayrollTransferDetail({ totalAmount: 1000, grossAmount: '1000' }, options);
    expect(detail.grossAmount).toBeUndefined();
    expect(detail.totalDeduction).toBeUndefined();
    expect(detail.workEntries).toEqual([]);
    expect(isPayrollTransferDetail({ ...detail, deductions: null })).toBe(false);
    expect(isPayrollTransferDetail({ ...detail, totalDeduction: '1000' })).toBe(false);
});
