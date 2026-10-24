import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SupportManagerPage from './SupportManagerPage';
import { getSupportManagementYearMonth } from '../../utils/supportManagementState';

const mockCanLeave = jest.fn();
jest.mock('./VehicleManagerPage', () => ({
  VehicleManagerPage: ({ onBeforeRepairLeaveChange }: { onBeforeRepairLeaveChange: (guard: (() => boolean) | null) => void }) => {
    const React = jest.requireActual('react');
    React.useEffect(() => { onBeforeRepairLeaveChange(mockCanLeave); return () => onBeforeRepairLeaveChange(null); }, [onBeforeRepairLeaveChange]);
    return <p>정비내역 입력 중</p>;
  },
}));
jest.mock('./CardManagerPage', () => ({ CardManagerPage: () => <p>카드 화면</p> }));
jest.mock('./AccommodationManager', () => ({ __esModule: true, default: () => null }));
jest.mock('./ExpenseLedgerPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./ExpenseClaimManagementPage', () => ({ __esModule: true, default: () => null }));
// Navigation guards do not open billing; keep this test independent of Firebase configuration.
jest.mock('../../components/support/SupportBillingClosingDialog', () => ({ __esModule: true, default: () => null }));
const renderPage = () => render(<MemoryRouter initialEntries={['/support/vehicles?view=ledger&ledger=repairs']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/support/*" element={<SupportManagerPage />} /></Routes></MemoryRouter>);
beforeEach(() => { mockCanLeave.mockReset().mockReturnValue(false); window.sessionStorage.setItem('cy.support-management.year-month', '2026-04'); });

test('정비 입력 보호를 거절하면 상단 카드 탭이 입력 화면을 제거하지 않는다', () => {
  renderPage();
  fireEvent.click(screen.getByRole('tab', { name: '카드' }));
  expect(mockCanLeave).toHaveBeenCalledTimes(1);
  expect(screen.getByText('정비내역 입력 중')).toBeInTheDocument();
  expect(screen.queryByText('카드 화면')).not.toBeInTheDocument();
  mockCanLeave.mockReturnValue(true);
  fireEvent.click(screen.getByRole('tab', { name: '카드' }));
  expect(screen.getByText('카드 화면')).toBeInTheDocument();
});

test('정비 입력 보호를 거절하면 상단 조회월도 유지한다', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
  expect(mockCanLeave).toHaveBeenCalledTimes(1);
  expect(getSupportManagementYearMonth()).toBe('2026-04');
});
