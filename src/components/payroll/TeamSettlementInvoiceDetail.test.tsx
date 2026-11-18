import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TeamSettlementInvoiceDetail } from './TeamSettlementInvoiceDetail';
import type { TeamSettlementDeductionItem } from '../../types/teamSettlement';

const item: TeamSettlementDeductionItem = { id: 'invoice', source: 'auto', origin: 'daily_advance_invoice', category: '대납청구비', amount: 880000,
  invoiceDetails: [
    { workerId: 'a', workerName: '소개 인원 A', recruiterFeeDates: ['2026-11-01', '2026-11-03'], manDay: 1.5, claimAmount: 150000, recruiterFee: 120000, invoiceAmount: 270000 },
    { workerId: 'b', workerName: '소개 인원 B', recruiterFeeDates: ['2026-11-02'], manDay: 2, claimAmount: 200000, recruiterFee: 60000, invoiceAmount: 260000 },
    { workerId: 'c', workerName: '소개비 없는 인원', manDay: 3.5, claimAmount: 350000, recruiterFee: 0, invoiceAmount: 350000 }
  ]
};

test('첫 화면에서 소개비 발생 인원과 청구 공수를 각각 금액과 함께 표시한다', () => {
  render(<TeamSettlementInvoiceDetail items={[item]} />);
  const table = within(screen.getByRole('table', { name: '대납청구비 요약' }));
  expect(table.getByRole('row', { name: /^인력소개비 2명 180,000원/ })).toBeVisible();
  expect(table.getByRole('row', { name: /^청구금액 7공수 700,000원/ })).toBeVisible();
  expect(screen.getByRole('group', { name: '소개비 포함 대납청구비 합계' })).toHaveTextContent('880,000원');
  expect(screen.queryByText('소개 인원 A')).not.toBeInTheDocument();
});

test('상세를 누르면 해당 항목의 인원별 금액을 표시하고 다시 누르면 접는다', () => {
  render(<TeamSettlementInvoiceDetail items={[item]} />);
  const fee = screen.getByRole('button', { name: '인력소개비 상세' });
  fireEvent.click(fee);
  const fees = within(screen.getByRole('table', { name: '인력소개비 인원별 금액' }));
  expect(fees.getByRole('columnheader', { name: '발생일수' })).toBeVisible();
  expect(fees.queryByRole('columnheader', { name: '공수' })).not.toBeInTheDocument();
  expect(fees.getByRole('row', { name: '소개 인원 A 2일 11/01, 11/03 120,000원' })).toBeVisible();
  expect(fees.getByRole('row', { name: '합계 3일 지정된 발생일 기준 180,000원' })).toBeVisible();
  expect(fees.queryByText('소개비 없는 인원')).not.toBeInTheDocument();
  expect(fee).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: '청구금액 상세' }));
  expect(screen.queryByRole('table', { name: '인력소개비 인원별 금액' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: '청구금액 인원별 금액' })).getByRole('row', { name: '소개비 없는 인원 3.5 350,000원' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '청구금액 상세' }));
  expect(screen.queryByRole('table', { name: '청구금액 인원별 금액' })).not.toBeInTheDocument();
});

test('내역이 없거나 소개비가 0원이어도 요약과 전체 합계를 표시한다', () => {
  const { rerender } = render(<TeamSettlementInvoiceDetail items={[]} />);
  expect(screen.getByRole('row', { name: /^인력소개비 0명 0원/ })).toBeVisible();
  expect(screen.getByRole('group', { name: '소개비 포함 대납청구비 합계' })).toHaveTextContent('0원');
  rerender(<TeamSettlementInvoiceDetail items={[{ ...item, amount: 350000, invoiceDetails: [item.invoiceDetails![2]] }]} />);
  expect(screen.getByRole('row', { name: /^인력소개비 0명 0원/ })).toBeVisible();
  expect(screen.getByRole('row', { name: /^청구금액 3\.5공수 350,000원/ })).toBeVisible();
});

test('발생일을 지정하지 않은 과거 소개비는 공수로 추측하지 않는다', () => {
  render(<TeamSettlementInvoiceDetail items={[{ ...item, invoiceDetails: [{ ...item.invoiceDetails![0], recruiterFeeDates: undefined }] }]} />);
  fireEvent.click(screen.getByRole('button', { name: '인력소개비 상세' }));
  expect(within(screen.getByRole('table', { name: '인력소개비 인원별 금액' })).getByRole('row', { name: '소개 인원 A 미지정 발생일 지정 필요 120,000원' })).toBeVisible();
});


test('같은 인원의 일급·용역 내역을 분리하고 용역 소개비를 다시 더하지 않는다', () => {
  render(<TeamSettlementInvoiceDetail items={[{ ...item, amount: item.amount + 160000, invoiceDetails: [...item.invoiceDetails!,
    { invoiceType: 'service', workerId: 'a', workerName: '소개 인원 A', manDay: 1, claimAmount: 100000, recruiterFee: 60000, invoiceAmount: 160000 }] }]} />);
  expect(screen.getByRole('row', { name: /^인력소개비 2명 180,000원/ })).toBeVisible();
  expect(screen.getByRole('row', { name: /^청구금액 7공수 700,000원/ })).toBeVisible();
  expect(screen.getByRole('row', { name: /^용역비 1공수 160,000원/ })).toBeVisible();
  expect(screen.getByRole('group', { name: '소개비 포함 대납청구비 합계' })).toHaveTextContent('1,040,000원');
  fireEvent.click(screen.getByRole('button', { name: '용역비 상세' }));
  expect(within(screen.getByRole('table', { name: '용역비 인원별 금액' })).getByRole('row', { name: '소개 인원 A 1 60,000원 160,000원' })).toBeVisible();
});
