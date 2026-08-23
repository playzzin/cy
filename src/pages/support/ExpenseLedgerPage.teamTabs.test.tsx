import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseLedgerPage from './ExpenseLedgerPage';
import { useExpenseLedgerData } from './hooks/useExpenseLedgerData';

jest.mock('./hooks/useExpenseLedgerData', () => {
  const hexToRgba = (hex: string, alpha: number) => {
    const normalized = hex.replace('#', '');
    const value = Number.parseInt(normalized, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  };
  return {
    useExpenseLedgerData: jest.fn(),
    formatCurrency: (amount: number) => `${amount.toLocaleString('ko-KR')}원`,
    getSummaryTotal: () => 0,
    hexToRgba,
    normalizeColor: (color?: string) => color || '#94a3b8',
  };
});

jest.mock('./components/ExpenseLedgerDetailBoard', () => ({
  ExpenseLedgerDetailBoard: () => <div>상세내역</div>,
}));

const mockUseExpenseLedgerData = useExpenseLedgerData as jest.MockedFunction<typeof useExpenseLedgerData>;

describe('ExpenseLedgerPage team tabs', () => {
  it('shows the registered team color and icon before the team name', () => {
    mockUseExpenseLedgerData.mockReturnValue({
      loading: false,
      teamOptions: [{
        id: 'team-1',
        name: '청연팀',
        type: 'direct',
        color: '#2563eb',
        iconKey: 'fa-crown',
      }],
      summaries: [],
      totals: {
        accommodation: 0,
        privateRoom: 0,
        utility: 0,
        vehicle: 0,
        card: 0,
        otherClaim: 0,
        officeExpense: 0,
        receivable: 0,
        payable: 0,
        total: 0,
      },
      selectedClaims: { receivable: [], payable: [], other: [], office: [] },
      statusCounts: {
        accommodationDraft: 0,
        accommodationConfirmed: 0,
        vehicleDraft: 0,
        vehiclePosted: 0,
        cardDraft: 0,
        cardPosted: 0,
        claimDraft: 0,
        claimCharged: 0,
        claimSettled: 0,
      },
      allCategoryOptions: [],
      loadData: jest.fn(),
      selectedRawDocs: { accommodationDocs: [], vehicleDocs: [], cardDocs: [] },
      rawDocs: { accommodationDocs: [], vehicleDocs: [], cardDocs: [] },
    } as unknown as ReturnType<typeof useExpenseLedgerData>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ExpenseLedgerPage embedded />
      </MemoryRouter>
    );

    const teamTab = screen.getByRole('tab', { name: '청연팀' });
    const teamVisual = within(teamTab).getByTitle('팀 색상 #2563eb');

    expect(teamVisual).not.toBeNull();
    expect(within(teamVisual).getByTestId('team-icon')).not.toBeNull();
  });
});
