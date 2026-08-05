import React from 'react';
import { render, screen } from '@testing-library/react';
import { PayslipExcelPrintTemplate } from './PayslipExcelPrintTemplate';
import type { PaymentData } from '../types/payroll';

const paymentData: PaymentData = {
    id: '2026-07__worker-1__월급제',
    workerId: 'worker-1',
    workerName: '홍길동',
    idNumber: '900101-1234567',
    teamId: 'team-1',
    teamName: '테스트팀',
    companyId: 'company-1',
    companyName: '기존 시공사',
    month: '2026-07',
    unitPrice: 200000,
    totalManDay: 1,
    grossAmount: 200000,
    totalDeduction: 50000,
    totalAmount: 150000,
    invoiceManDay: 0,
    invoiceGrossAmount: 0,
    invoiceNetAmount: 0,
    laborManDay: 1,
    laborGrossAmount: 200000,
    laborNetAmount: 150000,
    workEntries: [{
        date: '2026-07-01',
        siteName: '테스트 현장',
        paymentMethod: '노무',
        manDay: 1,
        unitPrice: 200000,
        amount: 200000,
    }],
    deductionBreakdown: {
        standardLines: [{ label: '가불', amount: 50000 }],
        additionalLines: [],
        total: 50000,
        hasData: true,
    },
    taxBreakdown: {
        standardLines: [],
        additionalLines: [],
        total: 0,
        hasData: false,
    },
    taxRateSnapshot: {
        pensionRate: 0,
        healthRate: 0,
        longtermRate: 0,
        employmentRate: 0,
        incomeTaxRate: 0,
        residentTaxRate: 0,
    },
    displayContent: '',
    bankCode: '011',
    bankName: '농협',
    accountNumber: '1234567890',
    accountHolder: '홍길동',
    isValid: true,
    errors: {},
};

describe('PayslipExcelPrintTemplate', () => {
    it('미리보기형 근무·공제 카드와 실지급 요약을 표시한다', () => {
        const { container } = render(
            <PayslipExcelPrintTemplate data={paymentData} contractorName="(주)청연이엔지" />
        );

        expect(screen.getByRole('heading', { name: '2026-07 노임명세서' })).toBeTruthy();
        expect(screen.getByText('테스트 현장')).toBeTruthy();
        expect(screen.getByText('가불')).toBeTruthy();
        expect(screen.getAllByText('(주)청연이엔지').length).toBeGreaterThanOrEqual(1);
        expect(container.querySelectorAll('.payslip-document-card')).toHaveLength(2);
        expect(screen.getByText('총 차감액 (공제 + 세금)')).toBeTruthy();
        expect(screen.getAllByText('150,000원').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('-50,000원').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('세금 내역이 없습니다.')).toBeTruthy();
    });
});
