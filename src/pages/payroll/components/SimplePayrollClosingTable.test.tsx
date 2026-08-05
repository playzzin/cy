import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SimplePayrollClosingTable } from './SimplePayrollClosingTable';

describe('SimplePayrollClosingTable', () => {
    it('summarizes existing payroll values and only exposes view-navigation actions', () => {
        const onOpenDetailed = jest.fn();
        const onOpenLedger = jest.fn();
        const onMarkReviewed = jest.fn();

        render(
            <SimplePayrollClosingTable
                rangeLabel="2026-07"
                onOpenDetailed={onOpenDetailed}
                onOpenLedger={onOpenLedger}
                runStatus="draft"
                onSaveDraft={jest.fn()}
                onMarkReviewed={onMarkReviewed}
                onConfirm={jest.fn()}
                onMarkPaid={jest.fn()}
                rows={[
                    {
                        id: 'worker-1',
                        month: '2026-07',
                        workerName: '홍길동',
                        teamName: 'A팀',
                        totalManDay: 2,
                        grossAmount: 200000,
                        personalDeduction: 30000,
                        taxDeduction: 10000,
                        totalDeduction: 40000,
                        netAmount: 160000,
                        isValid: true,
                    },
                    {
                        id: 'worker-2',
                        month: '2026-07',
                        workerName: '김철수',
                        teamName: 'B팀',
                        totalManDay: 1.5,
                        grossAmount: 150000,
                        personalDeduction: 20000,
                        taxDeduction: 5000,
                        totalDeduction: 25000,
                        netAmount: 125000,
                        isValid: false,
                    },
                ]}
            />
        );

        expect(screen.getByText('간편 급여 마감표')).not.toBeNull();
        expect(screen.getByText('285,000원')).not.toBeNull();
        expect(screen.getAllByText((_, element) => element?.textContent === '계좌 정보 확인 1명')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: '상세 급여표 보기' }));
        fireEvent.click(screen.getByRole('button', { name: '가불·공제 확인' }));
        fireEvent.click(screen.getByRole('button', { name: '검토 완료' }));

        expect(onOpenDetailed).toHaveBeenCalledTimes(1);
        expect(onOpenLedger).toHaveBeenCalledTimes(1);
        expect(onMarkReviewed).toHaveBeenCalledTimes(1);
    });
});
