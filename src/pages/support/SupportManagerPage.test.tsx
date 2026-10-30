import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SupportManagerPage from './SupportManagerPage';
import { shiftYearMonth } from '../../components/common/MonthNavigator';
import {
  getSupportManagementYearMonth,
} from '../../utils/supportManagementState';
import type { SupportManagementView } from '../../utils/supportManagementState';

type MockManagerProps = {
  initialTab?: SupportManagementView;
  onTabChange?: (tab: SupportManagementView) => void;
};

type MockClaimProps = {
  onDirtyChange?: (dirty: boolean) => void;
};

jest.mock('./VehicleManagerPage', () => ({
  VehicleManagerPage: ({ initialTab, onTabChange }: MockManagerProps) => {
    const { SupportBillingClosingGuardContext } = jest.requireActual('../../components/support/SupportBillingClosingGuard');
    const { useContext } = jest.requireActual('react');
    const register = useContext(SupportBillingClosingGuardContext);
    return (
    <div>
      <span data-testid="vehicle-view">{initialTab}</span>
      <input aria-label="저장 전 차량 메모" defaultValue="" />
      <button type="button" onClick={() => onTabChange?.('ledger')}>차량 통합관리대장 보기</button>
      <button type="button" onClick={() => register('vehicle', '대장 저장 중')}>저장 시작</button>
      <button type="button" onClick={() => register('vehicle', null)}>저장 완료</button>
    </div>
  ); },
}));

jest.mock('../../components/support/SupportBillingClosingDialog', () => ({
  __esModule: true,
  default: ({ domain, yearMonth, onClose }: { domain: string; yearMonth: string; onClose: () => void }) => (
    <div role="dialog" aria-label="청구 마감">
      <span>{domain} {yearMonth}</span>
      <button onClick={onClose}>마감 닫기</button>
    </div>
  ),
}));

jest.mock('./CardManagerPage', () => ({
  CardManagerPage: ({ initialTab }: MockManagerProps) => <span data-testid="card-view">{initialTab}</span>,
}));

jest.mock('./AccommodationManager', () => ({
  __esModule: true,
  default: ({ initialTab }: MockManagerProps) => <span data-testid="accommodation-view">{initialTab}</span>,
}));

jest.mock('./ExpenseLedgerPage', () => ({
  __esModule: true,
  default: ({ workspaceHeader }: { workspaceHeader?: React.ReactNode }) => <>{workspaceHeader}<span>통합 경비현황</span></>,
}));

jest.mock('./ExpenseClaimManagementPage', () => ({
  __esModule: true,
  default: ({ onDirtyChange }: MockClaimProps) => (
    <div>
      <span>경비입력 화면</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>작성 내용 만들기</button>
    </div>
  ),
}));

const renderPage = (entry = '/support/vehicles?view=status') => render(
  <MemoryRouter
    initialEntries={[entry]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <Routes>
      <Route path="/support/*" element={<SupportManagerPage />} />
    </Routes>
  </MemoryRouter>
);

describe('SupportManagerPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('keeps the ledger view when moving from vehicle to card', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '차량 통합관리대장 보기' }));
    fireEvent.click(screen.getByRole('tab', { name: '카드' }));

    expect(screen.getByTestId('card-view').textContent).toBe('ledger');
  });

  it('keeps unsaved ledger inputs mounted when closing review opens and closes', () => {
    renderPage('/support/vehicles?view=ledger');
    fireEvent.change(screen.getByLabelText('저장 전 차량 메모'), { target: { value: '작성 중 메모' } });
    fireEvent.click(screen.getByRole('button', { name: '청구 마감' }));
    expect(screen.getByRole('dialog', { name: '청구 마감' })).not.toBeNull();
    expect(screen.getByText(`vehicle ${getSupportManagementYearMonth()}`)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '마감 닫기' }));
    expect((screen.getByLabelText('저장 전 차량 메모') as HTMLInputElement).value).toBe('작성 중 메모');
    expect(screen.getByTestId('vehicle-view').textContent).toBe('ledger');
  });

  it('disables closing while a ledger is saving and enables it when complete', () => {
    renderPage('/support/vehicles?view=ledger');
    fireEvent.click(screen.getByRole('button', { name: '저장 시작' }));
    expect((screen.getByRole('button', { name: '청구 마감' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('대장 저장 중')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '청구 마감' }));
    expect(screen.queryByRole('dialog', { name: '청구 마감' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '저장 완료' }));
    expect((screen.getByRole('button', { name: '청구 마감' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the compact sticky workspace navigation', () => {
    renderPage('/support/accommodation?view=ledger');

    expect(screen.getByRole('banner').classList.contains('sticky')).toBe(true);
    expect(screen.getByRole('banner').classList.contains('top-0')).toBe(true);
    expect(screen.getByText('배정·경비 통합관리')).not.toBeNull();
    expect(screen.getByTestId('accommodation-view').textContent).toBe('ledger');
  });

  it('moves the shared month from the fixed workspace navigation', () => {
    const initialMonth = getSupportManagementYearMonth();
    renderPage('/support/expense-ledger?view=status');

    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));

    expect(getSupportManagementYearMonth()).toBe(shiftYearMonth(initialMonth, -1));
  });

  it('opens expense input inside the shared workspace navigation', () => {
    renderPage('/support/expense-claims?view=status');

    expect(screen.getByRole('tab', { name: '경비입력' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('경비입력 화면')).not.toBeNull();
    expect(screen.getByText('배정·경비 통합관리')).not.toBeNull();
  });

  it('protects unsaved expense input when moving to another workspace tab', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage('/support/expense-claims?view=status');

    fireEvent.click(screen.getByRole('button', { name: '작성 내용 만들기' }));
    fireEvent.click(screen.getByRole('tab', { name: '차량' }));

    expect(screen.getByText('경비입력 화면')).not.toBeNull();
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('tab', { name: '차량' }));
    expect(screen.getByTestId('vehicle-view')).not.toBeNull();
    confirmSpy.mockRestore();
  });
});
