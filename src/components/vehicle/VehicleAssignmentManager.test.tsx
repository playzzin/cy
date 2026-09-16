import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VehicleAssignmentManager } from './VehicleAssignmentManager';
import { vehicleService } from '../../services/vehicleService';
import { officeStaffService } from '../../services/officeStaffService';
import type { Worker } from '../../services/manpowerService';
import type { Company } from '../../services/companyService';
import type { Team } from '../../services/teamService';
import type { Vehicle, VehicleAssignmentRecord } from '../../types/vehicle';
import { OFFICE_ASSIGNMENT_TEAM_ID, appendOfficeAssignmentTeam } from '../../utils/supportAssignmentTargets';

jest.mock('../../services/vehicleService', () => ({ vehicleService: { listAllVehicleAssignments: jest.fn(async () => []) } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn(async () => []) } }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn() }, showConfirmAlert: jest.fn() }));

const workers: Worker[] = [
    { id: 'cy-active', name: '가상 청연 재직자', companyId: 'cy', status: '재직' },
    { id: 'cy-retired', name: '가상 청연 퇴사자', companyId: 'cy', status: '퇴사' },
    { id: 'partner', name: '가상 외부 인원', companyName: '외부 협력사', status: '재직' },
];
const companies: Company[] = [{ id: 'cy', code: 'CYENG', name: '청연이엔지', type: '시공사' }];
const selectableTeams = appendOfficeAssignmentTeam([{ id: 'team', name: '가상 청연팀', companyId: 'cy', type: '시공팀' } as Team]);
const vehicle = { id: 'test-car', licensePlate: '가상 차량', status: 'AVAILABLE' } as Vehicle;
const props = { vehicles: [vehicle], workers, companies, selectableTeams, loading: false, onRefresh: jest.fn() };
beforeEach(() => {
    jest.mocked(vehicleService.listAllVehicleAssignments).mockResolvedValue([]);
    jest.mocked(officeStaffService.getOfficeStaff).mockResolvedValue([]);
});

test('실제 운전자 선택에는 청연 재직자만 나오고 처음에는 직접 선택해야 한다', async () => {
    render(<VehicleAssignmentManager {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '운전자' }));
    const select = screen.getByRole('combobox', { name: '운전자 선택' });
    await waitFor(() => expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['운전자를 선택하세요', '가상 청연 재직자']));
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'cy-active' } });
    expect(select).toHaveValue('cy-active');
});

test('기존 퇴사 운전자 이력은 보존하고 다른 운전자로 자동 선택하지 않는다', async () => {
    const record = { id: 'past', vehicleId: vehicle.id, assigneeType: 'WORKER', assigneeId: 'cy-retired', assigneeName: '가상 청연 퇴사자', startDate: '2026-08-01' } as VehicleAssignmentRecord;
    jest.mocked(vehicleService.listAllVehicleAssignments).mockResolvedValue([record]);
    render(<VehicleAssignmentManager {...props} initialVehicleId={vehicle.id} />);
    const select = await screen.findByRole('combobox', { name: '운전자 선택' });
    await waitFor(() => expect(select).toHaveValue(''));
    expect(within(select).queryByRole('option', { name: /퇴사자/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('가상 청연 퇴사자').length).toBeGreaterThan(0);
    expect(props.onRefresh).not.toHaveBeenCalled();
});

test('사무실 배정도 퇴사·비활성 직원을 제외한다', async () => {
    jest.mocked(officeStaffService.getOfficeStaff).mockResolvedValue([
        { id: 'office-active', name: '가상 사무직 재직자', status: '재직' },
        { id: 'office-retired', name: '가상 사무직 퇴사자', status: '퇴사' },
        { id: 'office-inactive', name: '가상 비활성 직원', status: '재직', isActive: false },
    ]);
    render(<VehicleAssignmentManager {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: '배정 팀 선택' }), { target: { value: OFFICE_ASSIGNMENT_TEAM_ID } });
    fireEvent.click(screen.getByRole('button', { name: '운전자' }));
    const select = screen.getByRole('combobox', { name: '운전자 선택' });
    await waitFor(() => expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['운전자를 선택하세요', '가상 사무직 재직자 (사무실)']));
});
