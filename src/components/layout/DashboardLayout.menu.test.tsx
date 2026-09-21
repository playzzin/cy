import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { userService } from '../../services/userService';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import { getMenuModeStorageKey } from '../../utils/menuModeStorage';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorker: jest.fn(), getWorkerByUid: jest.fn() } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaffByUid: jest.fn().mockResolvedValue(null) } }));
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: jest.fn(() => jest.fn()) }));
jest.mock('../../constants/messages', () => ({ MessageManager: { setContext: jest.fn() } }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('./Header', () => () => null);
jest.mock('./Sidebar', () => () => null);
jest.mock('./LayoutBottomPanel', () => () => null);
jest.mock('./AdminPanel', () => () => null);
jest.mock('../../services/menuServiceV11', () => ({
    menuServiceV11: {
        subscribe: (listener: (value: unknown) => void) => {
            listener({
                admin: { name: 'ERP', menu: [], positionConfig: [
                    { id: 'dev', name: '개발자' },
                    { id: 'leader', name: '팀장' },
                ] },
                pos_dev: { name: 'DEV', menu: [] },
                pos_leader: { name: '팀장', menu: [] },
            });
            return () => undefined;
        },
    },
}));

const MenuProbe = () => <div data-testid="menu-mode">{useSiteMode().effectiveSite}</div>;
const app = () => <MemoryRouter><DashboardLayout><MenuProbe /></DashboardLayout></MemoryRouter>;

beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-account' } });
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', linkedWorkerIds: ['worker-1'] });
    (manpowerService.getWorkerByUid as jest.Mock).mockResolvedValue(null);
    (manpowerService.getWorker as jest.Mock).mockResolvedValue({ id: 'worker-1', role: '팀장' });
    (officeStaffService.getOfficeStaffByUid as jest.Mock).mockResolvedValue(null);
});

it('공용 dev 설정이 남고 UID 역조회가 없어도 연결 ID로 팀장 메뉴를 연다', async () => {
    localStorage.setItem('cy_current_position', 'dev');
    localStorage.setItem('cy_position_manual', 'true');
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode').textContent).toBe('pos_leader'));
    expect(manpowerService.getWorker).toHaveBeenCalledWith('worker-1');
    expect(localStorage.getItem(getMenuModeStorageKey('cy_current_position', 'leader-account'))).toBe('leader');
});

it('로그인 계정이 바뀌면 이전 계정의 수동 dev 선택을 초기화한다', async () => {
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'admin-account' } });
    localStorage.setItem(getMenuModeStorageKey('cy_current_position', 'admin-account'), 'dev');
    localStorage.setItem(getMenuModeStorageKey('cy_position_manual', 'admin-account'), 'true');
    const view = render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode').textContent).toBe('pos_dev'));
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-account' } });
    view.rerender(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode').textContent).toBe('pos_leader'));
});
