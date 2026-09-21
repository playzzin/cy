import React from 'react';
import { render, screen } from '@testing-library/react';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import { ExpenseLedgerDetailBoard } from './ExpenseLedgerDetailBoard';

jest.mock('../hooks/useExpenseLedgerData', () => ({
  formatCurrency: (value: number) => new Intl.NumberFormat('ko-KR').format(value),
  getBillingStatusLabel: (status: unknown) => String(status ?? ''),
  getCategoryLabel: (category: unknown) => String(category ?? ''),
  getStatusLabel: (status: unknown) => String(status ?? ''),
  hexToRgba: () => 'rgba(100, 116, 139, 0.15)',
  summarizeVehicleBillingCosts: () => ({
    rent: 0,
    lease: 0,
    fuel: 0,
    fine: 0,
    repair: 0,
    toll: 0,
    other: 0,
    total: 0,
  }),
}));

describe('ExpenseLedgerDetailBoard', () => {
  test('개인청구 숙소도 AI 원장에 저장된 금액을 상세표에 표시한다', () => {
    const accommodationDoc: AccommodationBillingDocument = {
      id: 'lee-worker-2026-08',
      yearMonth: '2026-08',
      teamId: 'lee-team',
      teamName: '이재욱팀',
      issuedToType: 'worker',
      issuedToWorkerId: 'worker-1',
      issuedToWorkerName: '신광식',
      status: 'draft',
      lineItems: [
        {
          id: 'rent',
          label: '신규숙소 월세',
          amount: 380000,
          targetField: 'accommodation',
          sourceType: 'utility_ledger',
          sourceAccommodationId: 'new-accommodation',
        },
        {
          id: 'electricity',
          label: '신규숙소 전기세',
          amount: 34780,
          targetField: 'electricity',
          sourceType: 'utility_ledger',
          sourceAccommodationId: 'new-accommodation',
        },
      ],
    };

    render(
      <ExpenseLedgerDetailBoard
        teamName="이재욱팀"
        color="#64748b"
        accommodationDocs={[accommodationDoc]}
        vehicleDocs={[]}
        cardDocs={[]}
        receivableClaims={[]}
        payableClaims={[]}
        otherClaims={[]}
        showClaims={false}
      />
    );

    expect(screen.getByText('신규숙소')).toBeTruthy();
    expect(screen.getAllByText('34,780').length).toBeGreaterThan(0);
    expect(screen.getAllByText('414,780').length).toBeGreaterThan(0);
    expect(screen.getByText('개인청구')).toBeTruthy();
  });

  test('선택한 세부 항목을 가로 스크롤 없는 맞춤 폭 상세표로 표시한다', () => {
    const accommodationDoc: AccommodationBillingDocument = {
      id: 'team-ledger-2026-08',
      yearMonth: '2026-08',
      teamId: 'lee-team',
      teamName: '이재욱팀',
      issuedToType: 'team',
      issuedToWorkerId: '',
      issuedToWorkerName: '',
      status: 'confirmed',
      lineItems: [
        {
          id: 'rent',
          label: '사동 1429-13 302호 월세',
          amount: 380000,
          targetField: 'accommodation',
          sourceType: 'utility_ledger',
          sourceAccommodationId: 'accommodation-1',
        },
        {
          id: 'electricity',
          label: '사동 1429-13 302호 전기세',
          amount: 54830,
          targetField: 'electricity',
          sourceType: 'utility_ledger',
          sourceAccommodationId: 'accommodation-1',
        },
      ],
    };

    render(
      <ExpenseLedgerDetailBoard
        teamName="이재욱팀"
        color="#64748b"
        accommodationDocs={[accommodationDoc]}
        vehicleDocs={[]}
        cardDocs={[]}
        receivableClaims={[]}
        payableClaims={[]}
        otherClaims={[]}
        selectedItemKey="electricity"
        fitWidth
        centerContent
      />
    );

    const detailPanel = screen.getByLabelText('이재욱팀 전기세 상세내역');
    expect(detailPanel).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
    expect(detailPanel.querySelector('.overflow-x-auto')).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
    const detailTable = detailPanel.querySelector('table');
    expect(detailTable?.className).toContain('table-fixed');
    expect(detailTable?.className).toContain('text-xs');
    // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
    expect(detailTable?.parentElement?.className).toContain('[&_th]:!text-center');
    // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
    expect(detailTable?.parentElement?.className).toContain('[&_td]:!text-center');
    expect(screen.getAllByText('54,830').length).toBeGreaterThan(0);
    expect(screen.queryByText('380,000')).toBeNull();
    expect(screen.getByText('숙소별 전기요금 청구 금액')).toBeTruthy();
  });
});

jest.mock('../../../components/SecureExpenseReceipt', () => ({ __esModule: true, default: () => null }));
