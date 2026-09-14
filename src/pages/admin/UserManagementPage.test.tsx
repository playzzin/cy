import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import UserManagementPage from './UserManagementPage';
import { userService } from '../../services/userService';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import { positionService } from '../../services/positionService';
import { accountLinkService } from '../../services/accountLinkService';
import { permissionAuditService } from '../../services/permissionAuditService';
import { userMenuPositionService } from '../../services/userMenuPositionService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'logged-admin' } }) }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => true }));
jest.mock('../../services/userService', () => ({ userService: { getAllUsers: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn() } }));
jest.mock('../../services/positionService', () => ({ positionService: { getPositions: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/accountLinkService', () => ({ accountLinkService: { updateUserAccess: jest.fn(), revokeUserAccessApproval: jest.fn() } }));
jest.mock('../../services/userAccessClaimsService', () => ({ userAccessClaimsService: {} }));
jest.mock('../../services/permissionAuditService', () => ({ permissionAuditService: { log: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../services/menuServiceV11', () => ({ menuServiceV11: { subscribe: () => () => undefined } }));
jest.mock('../../services/userMenuPositionService', () => ({ userMenuPositionService: { subscribe: (callback: (value: unknown) => void) => { callback({ 'sample-user': ['총괄'] }); return () => undefined; }, refresh: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../components/admin/IntegratedPositionManager', () => () => <div>직책별 설정 화면</div>);
jest.mock('../../components/admin/AccountLinkManager', () => (props: { selectedUserId: string; onManageAccess: (uid: string) => void }) => <div>연결 화면: {props.selectedUserId}<button onClick={() => props.onManageAccess(props.selectedUserId)}>직책·권한 돌아가기</button></div>);
jest.mock('sweetalert2', () => ({ fire: jest.fn().mockResolvedValue({ isConfirmed: true }) }));

const users = [
    { uid: 'sample-user', displayName: '예시 사용자', email: 'sample@example.test', role: 'user', position: '일반', status: 'active', linkedWorkerIds: ['worker-1'] },
    { uid: 'pending-user', displayName: '대기 사용자', email: 'pending@example.test', role: 'user', position: '', status: 'pending' },
];

beforeEach(() => {
    jest.clearAllMocks();
    (userService.getAllUsers as jest.Mock).mockResolvedValue(users);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'worker-1', uid: 'sample-user', name: '예시 작업자', role: '일반' }]);
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (positionService.getPositions as jest.Mock).mockResolvedValue([{ name: '일반', systemRole: '일반' }, { name: '총괄', systemRole: '매니저' }]);
    (accountLinkService.updateUserAccess as jest.Mock).mockResolvedValue({});
    (permissionAuditService.log as jest.Mock).mockResolvedValue(undefined);
    (userMenuPositionService.refresh as jest.Mock).mockResolvedValue(undefined);
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: true });
});

const open = async (path = '/admin/user-management') => {
    render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><UserManagementPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: '사용자 관리' });
    if (path === '/admin/user-management') await waitFor(() => expect(screen.getByLabelText('기본 직책')).toHaveValue('일반'));
};

it('직책을 한 번 선택해 권한과 추가 직책을 함께 저장한다', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('기본 직책'), { target: { value: '총괄' } });
    expect(screen.getByText('매니저', { selector: '.um-derived-role strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '직책·권한 저장' }));
    await waitFor(() => expect(accountLinkService.updateUserAccess).toHaveBeenCalledWith({ uid: 'sample-user', role: 'manager', position: '총괄', additionalPositions: [], syncLinkedProfiles: false }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('저장 완료', expect.any(String), 'success'));
    expect(accountLinkService.revokeUserAccessApproval).not.toHaveBeenCalled();
});

it('저장을 취소하면 권한 변경 요청을 보내지 않는다', async () => {
    await open();
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: false });
    fireEvent.change(screen.getByLabelText('기본 직책'), { target: { value: '총괄' } });
    fireEvent.click(screen.getByRole('button', { name: '직책·권한 저장' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
    expect(accountLinkService.updateUserAccess).not.toHaveBeenCalled();
});

it('이미 직책이 있는 승인 대기 계정도 같은 직책으로 승인할 수 있다', async () => {
    (userService.getAllUsers as jest.Mock).mockResolvedValue([{ ...users[0], status: 'pending' }]);
    await open();
    expect(screen.getByRole('button', { name: '직책·권한 저장' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '직책·권한 저장' }));
    await waitFor(() => expect(accountLinkService.updateUserAccess).toHaveBeenCalledWith(expect.objectContaining({ uid: 'sample-user', position: '일반', role: 'user' })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('저장 완료', expect.any(String), 'success'));
});

it('연결 대상 이름으로 찾고 검색 결과가 없어도 편집 중인 계정을 유지한다', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('기본 직책'), { target: { value: '총괄' } });
    fireEvent.change(screen.getByLabelText('사용자 검색'), { target: { value: '예시 작업자' } });
    expect(within(screen.getByLabelText('사용자 목록')).getAllByRole('button', { name: /예시 사용자/ })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('사용자 검색'), { target: { value: '없는 사용자' } });
    expect(screen.getByText('검색 조건에 맞는 사용자가 없습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('기본 직책')).toHaveValue('총괄');
});

it('점검 결과에서 해당 계정의 편집 화면으로 이동한다', async () => {
    await open('/admin/user-management/integrity');
    fireEvent.click(screen.getByRole('button', { name: '수정 →' }));
    await screen.findByRole('heading', { name: '대기 사용자' });
    expect(screen.getByLabelText('기본 직책')).toHaveValue('');
});

it('기존 직책 URL을 지원하고 직책·권한 영역을 활성화한다', async () => {
    await open('/admin/user-management/positions');
    expect(screen.getByText('직책별 설정 화면')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '직책·권한' })).toHaveAttribute('aria-current', 'page');
});

it('계정 연결과 권한 설정을 이동해도 선택한 계정이 유지된다', async () => {
    await open('/admin/user-management?user=pending-user');
    fireEvent.click(screen.getByRole('button', { name: '연결 관리 →' }));
    await screen.findByText('연결 화면: pending-user');
    fireEvent.click(screen.getByRole('button', { name: '직책·권한 돌아가기' }));
    await screen.findByRole('heading', { name: '대기 사용자' });
});
