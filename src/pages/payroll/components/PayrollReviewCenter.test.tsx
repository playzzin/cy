import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { PayrollReviewCenter } from './PayrollReviewCenter';
import type { PayrollReviewRow } from '../utils/payrollReview';

it('shows the scope and explains the problem before opening its source', () => {
    const onInspect = jest.fn();
    const row: PayrollReviewRow = { id: 'a', workerId: 'w', teamId: 't', workerName: '검증 작업자', teamName: '검증팀', month: '2026-09', salaryModel: 'monthly', totalManDay: 1, grossAmount: 100, personalDeduction: 0, taxDeduction: 0, totalDeduction: 0, deductionLineTotal: 0, netAmount: 90, bankCode: '004', accountNumber: 'test-account', accountHolder: '검증 작업자', isValid: true };
    render(<PayrollReviewCenter rows={[row]} rangeLabel="2026-09" busy={false} onInspect={onInspect} />);
    fireEvent.click(screen.getByText(/정산 확인센터/));
    expect(screen.getByText(/숙소·차량 원장 전체 대조/)).toBeInTheDocument();
    expect(screen.getByText(/표시된 실지급액은 90원/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '상세 급여 보기' }));
    expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'a', target: 'payroll' }));
    fireEvent.change(screen.getByRole('textbox', { name: '확인 항목 검색' }), { target: { value: '없는 작업자' } });
    expect(screen.getByText('검색 조건에 맞는 항목이 없습니다.')).toBeInTheDocument();
});
