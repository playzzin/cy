import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { TeamSettlementIncomingDetail } from './TeamSettlementIncomingDetail';

it('지원 온 여러 팀의 날짜·현장·공수와 합계를 표시한다', () => {
  render(<TeamSettlementIncomingDetail rows={[
    { id: 'a', date: '2026-09-01', siteId: 's', siteName: 'A현장', teamId: 'b', teamName: 'B지원팀', manDay: 2, supportRate: 250000, supportAmount: 500000 },
    { id: 'b', date: '2026-09-02', siteId: 's', siteName: 'A현장', teamId: 'c', teamName: 'C지원팀', manDay: 1.5, supportRate: 230000, supportAmount: 345000 },
  ]} />);
  expect(screen.getByText('B지원팀')).toBeInTheDocument();
  expect(screen.getByText('C지원팀')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /지원 공수 합계/ })).getByText('3.5공')).toBeInTheDocument();
  expect(screen.queryByText('개인단가')).not.toBeInTheDocument();
  expect(screen.getByText('250,000원')).toBeInTheDocument();
  expect(screen.getByText('845,000원')).toBeInTheDocument();
});
