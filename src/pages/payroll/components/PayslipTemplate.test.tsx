import React from 'react';
import { render, screen } from '@testing-library/react';
import { PayslipTemplate } from './PayslipTemplate';
import type { PaymentData } from '../types/payroll';

const paymentData: PaymentData = {
    id: '2026-07__worker-1__월급제',
    workerId: 'worker-1',
    workerName: '홍길동',
    idNumber: '',
    teamId: 'team-1',
    teamName: '테스트팀',
    companyId: 'company-1',
    companyName: '기존 시공사',
    month: '2026-07',
    unitPrice: 100000,
    totalManDay: 1,
    grossAmount: 100000,
    totalDeduction: 0,
    totalAmount: 100000,
    invoiceManDay: 1,
    invoiceGrossAmount: 100000,
    invoiceNetAmount: 100000,
    laborManDay: 0,
    laborGrossAmount: 0,
    laborNetAmount: 0,
    workEntries: [],
    deductionBreakdown: {
        standardLines: [],
        additionalLines: [],
        totalStandard: 0,
        totalAdditional: 0,
        total: 0,
        hasData: false,
    },
    taxBreakdown: {
        standardLines: [],
        additionalLines: [],
        totalStandard: 0,
        totalAdditional: 0,
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
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    isValid: true,
    errors: {},
};

describe('PayslipTemplate', () => {
    it('선택한 시공사 상호를 기존 데이터보다 우선 표시한다', () => {
        render(
            <PayslipTemplate
                data={paymentData}
                month="2026-07"
                contractorName="새로운 사업자"
            />
        );

        expect(screen.getByText('새로운 사업자')).toBeTruthy();
        expect(screen.queryByText('기존 시공사')).toBeNull();
    });
});
