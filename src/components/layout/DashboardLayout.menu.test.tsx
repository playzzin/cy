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
jest.mock('./Header', () => ({ toggleSidebar, canPreviewUsers, changePosition }: any) => <header><button onClick={toggleSidebar}>메뉴 토글</button>{canPreviewUsers && <><button onClick={() => changePosition('leader')}>상단 팀장 시점</button><button onClick={() => changePosition('ceo')}>상단 CEO 선택</button></>}</header>);
jest.mock('../developer/DevUserPreview', () => ({ positionId, onExit }: any) => <section aria-label="사용자 시점 확인"><span>{positionId}</span><button onClick={onExit}>내 화면으로 복귀</button></section>);
jest.mock('./Sidebar', () => ({ side, closeAll }: any) => <nav data-testid="sidebar" data-side={side}><button onClick={closeAll}>메뉴 닫기</button></nav>);
jest.mock('./LayoutBottomPanel', () => () => null);
jest.mock('./AdminPanel', () => () => null);
jest.mock('../../services/menuServiceV11', () => ({
    menuServiceV11: {
        subscribe: (listener: (value: unknown) => void) => {
            listener({
                admin: { name: 'ERP', menu: [], positionConfig: [
                    { id: 'dev', name: '개발자' },
                    { id: 'ceo', name: 'CEO' },
                    { id: 'manager', name: '매니저' },
                    { id: 'leader', name: '팀장' },
                    { id: 'custom-foreman', name: '반장' },
                    { id: 'worker', name: '작업자' },
                    { id: 'rental', name: '임대사' },
                    { id: 'client', name: '건설' },
                    { id: 'referral', name: '소개소' },
                    { id: 'office', name: '사무실' },
                ] },
                pos_dev: { name: 'DEV', menu: [] },
                pos_ceo: { name: 'CEO', menu: [] },
                pos_manager: { name: '매니저', menu: [] },
                pos_leader: { name: '팀장', menu: [] },
                'pos_custom-foreman': { name: '반장', menu: [] },
                pos_worker: { name: '작업자', menu: [] },
                pos_rental: { name: '임대사', menu: [] },
                pos_client: { name: '건설', menu: [] },
                pos_referral: { name: '소개소', menu: [] },
                pos_office: { name: '사무실', menu: [] },
                test: { name: '청연', menu: [] },
            });
            return () => undefined;
        },
    },
}));

const MenuProbe = () => {
    const mode = useSiteMode();
    return <div><div data-testid="menu-mode">{mode.effectiveSite}</div><button onClick={() => mode.changePosition('office')}>사무실 메뉴로 전환</button></div>;
};
// eslint-disable-next-line testing-library/no-node-access
const layoutShell = () => document.querySelector('.app');
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
    expect(document.documentElement).toHaveAttribute('data-team-typography', 'baemin');
});

it('팀장 메뉴에서 다른 직책으로 이동하거나 레이아웃을 닫으면 글꼴 범위를 해제한다', async () => {
    const view = render(app());
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-team-typography', 'baemin'));
    fireEvent.click(screen.getByRole('button', { name: '사무실 메뉴로 전환' }));
    await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-team-typography'));
    view.unmount();
    render(app());
    expect(document.documentElement).not.toHaveAttribute('data-team-typography');
});

it('팀장 레이아웃이 사라지면 로그인 화면에 글꼴 설정을 남기지 않는다', async () => {
    const view = render(app());
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-team-typography', 'baemin'));
    view.unmount();
    expect(document.documentElement).not.toHaveAttribute('data-team-typography');
});

it('통합 전 매니저 메뉴를 수동 선택해 둔 계정도 현재 매니저 메뉴로 연결한다', async () => {
    localStorage.setItem(getMenuModeStorageKey('cy_current_position', 'leader-account'), 'retired-manager-id');
    localStorage.setItem(getMenuModeStorageKey('cy_position_manual', 'leader-account'), 'true');
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', position: '매니저' });
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('pos_manager'));
    expect(localStorage.getItem(getMenuModeStorageKey('cy_current_position', 'leader-account'))).toBe('manager');
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

it.each(['DEV', 'CEO'])('%s 상단 직책모드에서 사용자 화면만 표시하고 복귀하면 기존 메뉴를 복원한다', async position => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin', position, status: 'active' });
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    render(app());
    fireEvent.click(await screen.findByRole('button', { name: '상단 팀장 시점' }));
    expect(screen.getByRole('region', { name: '사용자 시점 확인' })).toHaveTextContent('leader');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '메뉴 토글' })).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute('data-team-typography');
    fireEvent.click(screen.getByRole('button', { name: '내 화면으로 복귀' }));
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('pos_' + position.toLowerCase()));
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
});

it('CEO가 자신의 직책을 선택하면 미리보기를 열지 않는다', async () => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', position: 'CEO', status: 'active' });
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('pos_ceo'));
    fireEvent.click(await screen.findByRole('button', { name: '상단 CEO 선택' }));
    expect(screen.queryByRole('region', { name: '사용자 시점 확인' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
});

it.each([{ status: 'active', role: 'admin', position: '팀장' }, { status: 'suspended', role: 'admin', position: 'CEO' }])('일반 관리자나 비활성 CEO에는 미리보기 진입을 제공하지 않는다', async profile => {
    (userService.getUser as jest.Mock).mockResolvedValue(profile);
    render(app());
    await waitFor(() => expect(userService.getUser).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '상단 팀장 시점' })).not.toBeInTheDocument();
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
    expect(document.documentElement).not.toHaveAttribute('data-team-typography');
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
    } finally {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    }
});

it('팀장 직책 저장값이 있어도 청연 사이트 메뉴는 기존 배치를 사용한다', async () => {
    localStorage.setItem(getMenuModeStorageKey('cy_current_position', 'leader-account'), 'leader');
    localStorage.setItem(getMenuModeStorageKey('cy_current_site', 'leader-account'), 'test');
    localStorage.setItem(getMenuModeStorageKey('cy_site_manual', 'leader-account'), 'true');
    render(app());
    await waitFor(() => expect(screen.getByTestId('menu-mode')).toHaveTextContent('test'));
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-side', 'left');
});
