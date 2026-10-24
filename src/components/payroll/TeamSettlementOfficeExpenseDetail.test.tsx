import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { TeamSettlementOfficeExpenseDetail } from './TeamSettlementOfficeExpenseDetail';
import { calculateTeamSettlementOfficeExpense } from '../../utils/teamSettlementOfficeExpense';

test('사무실비 상세에 현장별 구분·단가·금액과 저장 합계를 표시한다', () => {
  const detail = calculateTeamSettlementOfficeExpense([
    { id: 'c', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '도급 현장', manDay: 10, amount: 900000 },
    { id: 'd', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '직영 현장', manDay: 8, amount: 800000 }
  ]);
  render(<TeamSettlementOfficeExpenseDetail detail={{ ...detail, savedAmount: 140000 }} />);
  expect(screen.getByRole('row', { name: '도급 현장 도급 10.0 10,000원 100,000원' })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: '직영 현장 직영 8.0 5,000원 40,000원' })).toBeInTheDocument();
  expect(screen.getByText('140,000원')).toBeInTheDocument();
  expect(screen.queryByText('900,000원')).not.toBeInTheDocument();
});
