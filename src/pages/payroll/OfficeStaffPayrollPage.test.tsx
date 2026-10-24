import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OfficeStaffPayrollPage from './OfficeStaffPayrollPage';
import { officeStaffService } from '../../services/officeStaffService';
import { officeStaffPayrollService } from '../../services/officeStaffPayrollService';
import { STORAGE_KEY, buildStaffDisplayRow } from './officeStaffPayrollModel';
import { payrollDraftKey } from './useSharedOfficePayroll';

jest.mock('../../config/firebase', () => ({ auth: { currentUser: { uid: 'synthetic-user' } } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn() } }));
jest.mock('../../services/officeStaffPayrollService', () => ({ ...jest.requireActual('../../services/officeStaffPayrollService'), officeStaffPayrollService: { loadMonth: jest.fn(), saveMonth: jest.fn() } }));
const renderPage = () => render(<MemoryRouter initialEntries={['/payroll/office-staff-payroll?yearMonth=2026-01']}><OfficeStaffPayrollPage /></MemoryRouter>);
const staff = { id: 'a', name: '검증 직원', unitPrice: 1000, status: '재직' } as Parameters<typeof buildStaffDisplayRow>[0];
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([staff]);
    (officeStaffPayrollService.loadMonth as jest.Mock).mockResolvedValue({ data: null, revision: 0 });
    (officeStaffPayrollService.saveMonth as jest.Mock).mockResolvedValue(1);
});
it('조회만으로 공용 자료나 기존 브라우저 자료를 변경하지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '공용 저장' })).toBeEnabled());
    expect(officeStaffPayrollService.saveMonth).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
it('기존 브라우저 월 입력을 검토 후 최초 공용 저장하며 원본을 보존한다', async () => {
    const legacy = JSON.stringify({ '2026-01': { rowInputs: { 'staff:a': { baseSalary: 2000 } } } });
    localStorage.setItem(STORAGE_KEY, legacy);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toHaveValue(2000));
    fireEvent.click(screen.getByRole('button', { name: '공용 저장' }));
    await waitFor(() => expect(officeStaffPayrollService.saveMonth).toHaveBeenCalledWith('2026-01', expect.objectContaining({ grossPaySnapshot: [expect.objectContaining({ grossPay: 2000 })] }), 0));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy);
    expect(await screen.findByRole('status')).toHaveTextContent('공용 저장했습니다');
});
it('현재 직원 기본급 변경이나 브라우저 값보다 공용 저장 당시 급여를 우선한다', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ '2026-01': { rowInputs: { 'staff:a': { baseSalary: 9000 } } } }));
    (officeStaffPayrollService.loadMonth as jest.Mock).mockResolvedValue({ revision: 4, data: { staffSnapshot: [buildStaffDisplayRow(staff, 0, { baseSalary: 3000 })] } });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toHaveValue(3000));
    fireEvent.click(screen.getByRole('button', { name: '공용 저장' }));
    await waitFor(() => expect(officeStaffPayrollService.saveMonth).toHaveBeenCalledWith('2026-01', expect.objectContaining({ grossPaySnapshot: [expect.objectContaining({ grossPay: 3000 })] }), 4));
});
it('충돌과 재조회 실패에 입력값과 임시 보관을 유지한다', async () => {
    (officeStaffPayrollService.saveMonth as jest.Mock).mockRejectedValue(new Error('다른 화면에서 변경했습니다'));
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('검증 직원 기본급'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: '공용 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 화면');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: '공용 자료 다시 불러오기' }));
    expect(officeStaffPayrollService.loadMonth).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    (officeStaffPayrollService.loadMonth as jest.Mock).mockRejectedValue({ code: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: '공용 자료 다시 불러오기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('조회 실패'));
    expect(screen.getByLabelText('검증 직원 기본급')).toHaveValue(2500);
    expect(localStorage.getItem(payrollDraftKey('2026-01'))).toContain('2500');
    confirm.mockRestore();
});
it('월을 이동했다 돌아와도 미저장 입력을 복원하고 다른 월에 쓰지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('검증 직원 기본급'), { target: { value: '2500' } });
    fireEvent.change(screen.getByLabelText('지급월'), { target: { value: '2026-02' } });
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toHaveValue(1000));
    fireEvent.change(screen.getByLabelText('지급월'), { target: { value: '2026-01' } });
    await waitFor(() => expect(screen.getByLabelText('검증 직원 기본급')).toHaveValue(2500));
    expect(officeStaffPayrollService.saveMonth).not.toHaveBeenCalled();
});
it('공용 조회 실패 시 기존 브라우저 값을 덮어쓸 수 없게 저장을 차단한다', async () => {
    (officeStaffPayrollService.loadMonth as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
    expect(screen.getByRole('button', { name: '공용 저장' })).toBeDisabled();
});
