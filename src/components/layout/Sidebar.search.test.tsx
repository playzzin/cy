import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { MenuItem, SiteData } from '../../types/menu';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: jest.fn(() => jest.fn()) }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../../utils/devAdminFixtures', () => ({ devUsers: [] }));
jest.mock('../../services/userMenuPositionService', () => ({ userMenuPositionService: {} }));
jest.mock('../../services/rolePermissionService', () => ({
    rolePermissionService: {
        subscribe: () => () => undefined,
        getPermissions: async () => ({}),
        hasAccess: () => true
    }
}));

const menu: MenuItem[] = [
    { id: 'reports', text: '현장 관리', sub: [
        { text: '보고서', sub: [
            { text: '급여 관리', path: '/payroll?tab=monthly' },
            '일보목록v2',
            { text: '급여 관리자 전용', path: '/restricted', roles: ['admin'] },
            { text: '급여 숨김', path: '/hidden', hide: true }
        ] }
    ] },
    { id: 'excel', text: 'Excel 변환', path: '/excel?newTab=1' }
];
const site: SiteData = { name: '테스트', icon: 'fa-list', menu, sidebarSearchEnabled: true };
const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
};
const defaults = {
    currentSite: 'admin', currentSiteData: site, closeAll: jest.fn(), activeMenuItems: {},
    activeNestedMenuItems: {}, toggleSubmenu: jest.fn(), toggleNestedSubmenu: jest.fn(),
    handleMenuItemClick: jest.fn(), handleSubMenuClick: jest.fn(), handleLogoClick: jest.fn(),
    menuPaths: { '일보목록v2': '/reports/daily?tab=list-v2' }, isSidebarCollapsed: false,
    isMobile: false, openMobileSidebar: jest.fn(), toggleSidebar: jest.fn()
};
const app = (props: Partial<React.ComponentProps<typeof Sidebar>> = {}) => (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Sidebar {...defaults} {...props} /><LocationProbe /></MemoryRouter>
);
const searchFor = (value: string) => fireEvent.change(screen.getByRole('searchbox', { name: '메뉴 검색' }), { target: { value } });

beforeEach(() => jest.clearAllMocks());

it('설정을 켰을 때만 검색을 표시하고 사이트 변경 시 검색어를 초기화한다', async () => {
    const view = render(app({ currentSiteData: { ...site, sidebarSearchEnabled: undefined } }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    view.rerender(app());
    searchFor('급여');
    view.rerender(app({ currentSite: 'pos_leader' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    view.rerender(app({ currentSiteData: { ...site, sidebarSearchEnabled: false } }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(await screen.findByText('현장 관리')).toBeInTheDocument();
});

it('접힌 하위 메뉴를 검색하고 권한이 없거나 숨긴 항목은 결과에서 제외한다', async () => {
    render(app());
    searchFor('급여관리');
    const results = screen.getByRole('list', { name: '메뉴 검색 결과' });
    expect(within(results).getAllByRole('link')).toHaveLength(1);
    expect(within(results).getByText('현장 관리 › 보고서')).toBeInTheDocument();
    fireEvent.click(within(results).getByRole('link', { name: /급여 관리/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/payroll?tab=monthly');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await waitFor(() => expect(screen.queryByRole('list', { name: '메뉴 검색 결과' })).not.toBeInTheDocument());
});

it('부모 메뉴명, 표시명, 공백과 영문 대소문자로 검색하고 Esc 또는 지우기로 복원한다', async () => {
    render(app());
    searchFor('현장관리');
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과 2개');
    searchFor('일보목록');
    expect(screen.getByRole('link', { name: /일보목록/ })).toHaveAttribute('href', '/reports/daily?tab=list-v2');
    searchFor('없는메뉴');
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과가 없습니다.');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.getByRole('searchbox')).toHaveValue('');
    searchFor(' excel 변환 ');
    expect(screen.getByRole('link', { name: 'Excel 변환' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '메뉴 검색어 지우기' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});

it('접힌 검색 버튼으로 펼친 뒤 입력창에 초점을 맞추며 모바일에서도 입력할 수 있다', async () => {
    const view = render(app({ isSidebarCollapsed: true }));
    fireEvent.click(screen.getByRole('button', { name: '메뉴 검색 열기' }));
    expect(defaults.toggleSidebar).toHaveBeenCalledTimes(1);
    view.rerender(app());
    expect(screen.getByRole('searchbox')).toHaveFocus();
    view.rerender(app({ isSidebarCollapsed: true, isMobile: true }));
    searchFor('급여');
    fireEvent.click(screen.getByRole('link', { name: /급여 관리/ }));
    expect(defaults.closeAll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/payroll?tab=monthly'));
});

it('검색 결과에서도 새 탭 메뉴 설정을 유지한다', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(app());
    searchFor('excel');
    fireEvent.click(screen.getByRole('link', { name: 'Excel 변환' }));
    expect(open).toHaveBeenCalledWith('/excel?newTab=1', '_blank', 'noopener,noreferrer');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    open.mockRestore();
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue(''));
});
