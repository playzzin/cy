import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
jest.mock('./Header', () => ({ toggleSidebar, canPreviewUsers, changePosition }: any) => <header><button onClick={toggleSidebar}>메뉴 토글</button>{canPreviewUsers && <button onClick={() => changePosition('leader')}>상단 팀장 시점</button>}</header>);
jest.mock('../developer/DevUserPreview', () => ({ positionId, onExit }: any) => <section aria-label="사용자 시점 확인"><span>{positionId}</span><button onClick={onExit}>DEV로 복귀</button></section>);
jest.mock('./Sidebar', () => ({ side, closeAll }: any) => <nav data-testid="sidebar" data-side={side}><button onClick={closeAll}>메뉴 닫기</button></nav>);
jest.mock('./LayoutBottomPanel', () => () => null);
jest.mock('./AdminPanel', () => () => null);
jest.mock('../../services/menuServiceV11', () => ({
    menuServiceV11: {
        subscribe: (listener: (value: unknown) => void) => {
            listener({
                admin: { name: 'ERP', menu: [], positionConfig: [
                    { id: 'dev', name: '개발자' },
                    { id: 'leader', name: '팀장' },
                    { id: 'custom-foreman', name: '반장' }, { id: 'worker', name: '작업자' },
                    { id: 'rental', name: '임대사' }, { id: 'client', name: '건설' },
                    { id: 'referral', name: '소개소' }, { id: 'office', name: '사무실' },
                ] },
                pos_dev: { name: 'DEV', menu: [] },
                pos_leader: { name: '팀장', menu: [] },
                'pos_custom-foreman': { name: '현장 관리', menu: [] },
                pos_worker: { name: '작업자', menu: [] }, pos_rental: { name: '임대사', menu: [] },
                pos_client: { name: '건설', menu: [] }, pos_referral: { name: '소개소', menu: [] },
                pos_office: { name: '사무실', menu: [] }, test: { name: '청연', menu: [] },
            });
            return () => undefined;
        },
    },
}));

// The non-semantic shell owns the CSS direction and mobile open state.
// eslint-disable-next-line testing-library/no-node-access
const layoutShell = () => document.querySelector('.app');

const MenuProbe = () => {
    const mode = useSiteMode();
    return <div><div data-testid="menu-mode">{mode.effectiveSite}</div><button onClick={() => mode.changePosition('office')}>사무실 메뉴로 전환</button></div>;
};
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

it.each([
    ['leader', '팀장'], ['custom-foreman', '반장'], ['worker', '작업자'],
    ['rental', '임대사'], ['client', '건설'], ['referral', '소개소'],
])('%s 직책 자동 적용 시 오른쪽 메뉴를 사용한다', async (id, name) => {
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', position: name });
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('pos_' + id));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'right');
    expect(layoutShell()).toHaveClass('sidebar-right');
});

it.each(['office', 'dev', 'full'])('%s 메뉴는 기존 왼쪽 배치를 유지한다', async id => {
    localStorage.setItem(getMenuModeStorageKey('cy_current_position', 'leader-account'), id);
    localStorage.setItem(getMenuModeStorageKey('cy_position_manual', 'leader-account'), 'true');
    render(app());
    await screen.findByTestId('sidebar');
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'left');
    expect(layoutShell()).not.toHaveClass('sidebar-right');
});

it('모바일 메뉴를 열고 닫거나 직책을 전환해도 배치와 열린 상태가 일치한다', async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
        render(app());
        await waitFor(() => expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'right'));
        fireEvent.click(screen.getByRole('button', { name: '메뉴 토글' }));
        expect(layoutShell()).toHaveClass('mobile-open');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(layoutShell()).not.toHaveClass('mobile-open');
        fireEvent.click(screen.getByRole('button', { name: '메뉴 토글' }));
        fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }));
        expect(layoutShell()).not.toHaveClass('mobile-open');
        fireEvent.click(screen.getByRole('button', { name: '사무실 메뉴로 전환' }));
        await waitFor(() => expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'left'));
    } finally { Object.defineProperty(window, 'innerWidth', { configurable: true, value: width }); }
});

it('팀장 직책 저장값이 있어도 청연 사이트 메뉴는 기존 배치를 사용한다', async () => {
    localStorage.setItem(getMenuModeStorageKey('cy_current_position', 'leader-account'), 'leader');
    localStorage.setItem(getMenuModeStorageKey('cy_current_site', 'leader-account'), 'test');
    localStorage.setItem(getMenuModeStorageKey('cy_site_manual', 'leader-account'), 'true');
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('test'));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'left');
});

it('DEV 상단 직책모드에서 사용자 화면만 표시하고 복귀하면 기존 DEV 메뉴를 복원한다', async () => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin', position: 'DEV', status: 'active' });
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    render(app());
    fireEvent.click(await screen.findByRole('button', { name: '상단 팀장 시점' }));
    expect(screen.getByRole('region', { name: '사용자 시점 확인' })).toHaveTextContent('leader');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '메뉴 토글' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DEV로 복귀' }));
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('pos_dev'));
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
});
