import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  ExpenseLedgerDetailBoard: ({ selectedItemKey, fitWidth, centerContent }: { selectedItemKey?: string; fitWidth?: boolean; centerContent?: boolean }) => (
    <div data-testid="expense-detail-board" data-fit-width={fitWidth ? 'true' : 'false'} data-center-content={centerContent ? 'true' : 'false'}>상세내역:{selectedItemKey || '전체'}</div>
  ),
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

    const teamTab = screen.getByRole('tab', { name: /청연팀/ });
    const teamVisual = within(teamTab).getByTitle('팀 색상 #2563eb');

    expect(teamVisual).not.toBeNull();
    expect(within(teamVisual).getByTestId('team-icon')).not.toBeNull();
  });

  it('opens item details as a left accordion while keeping the full team detail on the right', () => {
    mockUseExpenseLedgerData.mockReturnValue({
      loading: false,
      teamOptions: [{
        id: 'team-1',
        name: '청연팀',
        type: 'direct',
        color: '#2563eb',
        iconKey: 'fa-crown',
      }],
      summaries: [{
        teamId: 'team-1',
        teamName: '청연팀',
        color: '#2563eb',
        card: 125000,
      }],
      totals: {
        accommodation: 0,
        privateRoom: 0,
        utility: 0,
        vehicle: 0,
        card: 125000,
        otherClaim: 0,
        officeExpense: 0,
        receivable: 0,
        payable: 0,
        total: 125000,
      },
      selectedClaims: { receivable: [], payable: [], other: [], office: [] },
      statusCounts: {
        accommodationDraft: 0,
        accommodationConfirmed: 0,
        vehicleDraft: 0,
        vehiclePosted: 0,
        cardDraft: 0,
        cardPosted: 1,
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

    fireEvent.click(screen.getByRole('tab', { name: /청연팀/ }));

    const itemMenu = screen.getByRole('region', { name: '청연팀 상세 항목 선택' });
    // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
    expect(itemMenu.parentElement?.className).toContain('xl:grid-cols-[35%_minmax(0,1fr)]');
    expect(screen.getByRole('region', { name: '청연팀 전체 상세내역' })).not.toBeNull();
    expect(screen.getByText('상세내역:전체')).not.toBeNull();
    expect(screen.getByText('상세내역:전체').getAttribute('data-fit-width')).toBe('true');
    expect(screen.getByText('상세내역:전체').getAttribute('data-center-content')).toBe('true');
    expect(screen.queryByText('상세내역:card')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '카드값 상세 보기' }));

    expect(screen.getByRole('region', { name: '카드값 아코디언 상세내역' })).not.toBeNull();
    expect(screen.getByText('상세내역:card')).not.toBeNull();
    expect(screen.getByText('상세내역:card').getAttribute('data-fit-width')).toBe('true');
    expect(screen.getByText('상세내역:card').getAttribute('data-center-content')).toBe('true');
    expect(screen.getByText('상세내역:전체')).not.toBeNull();
    expect(screen.getByRole('button', { name: '카드값 상세 닫기' }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '숙소비 상세 보기' }));

    expect(screen.queryByRole('region', { name: '카드값 아코디언 상세내역' })).toBeNull();
    expect(screen.queryByText('상세내역:card')).toBeNull();
    expect(screen.getByRole('region', { name: '숙소비 아코디언 상세내역' })).not.toBeNull();
    expect(screen.getByText('상세내역:accommodation')).not.toBeNull();
    expect(screen.getByRole('button', { name: '숙소비 상세 닫기' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('상세내역:전체')).not.toBeNull();
  });
});
