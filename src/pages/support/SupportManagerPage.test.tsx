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
  VehicleManagerPage: ({ initialTab, onTabChange }: MockManagerProps) => (
    <div>
      <span data-testid="vehicle-view">{initialTab}</span>
      <button type="button" onClick={() => onTabChange?.('ledger')}>차량 통합관리대장 보기</button>
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
  default: () => <span>통합 경비현황</span>,
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
