import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdvancedMenuManager from './AdvancedMenuManager';
import { menuServiceV11 } from '../../../services/menuServiceV11';
import type { SiteDataType } from '../../../types/menu';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../../contexts/SiteModeContext', () => ({ useSiteMode: () => ({ positions: [], changePosition: jest.fn() }) }));
jest.mock('../../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../../../services/menuServiceV11', () => ({ menuServiceV11: { subscribe: jest.fn(), getMenuConfig: jest.fn(), saveMenuConfig: jest.fn() } }));
jest.mock('./components/MenuManagerHeader', () => () => null);
jest.mock('./components/RoleManager', () => () => null);
jest.mock('./components/SiteManager', () => () => null);
jest.mock('./components/PositionMenuCopyModal', () => () => null);
jest.mock('./components/IconPicker', () => () => null);
jest.mock('./components/ToolboxPanel', () => ({ onAddDivider }: { onAddDivider?: () => void }) => onAddDivider ? <button onClick={onAddDivider}>구분선 바로 추가</button> : null);

const config: SiteDataType = { admin: { name: '테스트', icon: 'faFolder', menu: [
    { id: 'a', text: '출력 관리', path: '/reports' },
    { id: 'b', text: '급여 관리', path: '/payroll', sub: [{ id: 'child', text: '급여 내역', path: '/payroll/history' }] }
] } };

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (menuServiceV11.getMenuConfig as jest.Mock).mockResolvedValue(JSON.parse(JSON.stringify(config)));
    (menuServiceV11.subscribe as jest.Mock).mockImplementation(listener => { listener(JSON.parse(JSON.stringify(config))); return jest.fn(); });
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementation(async data => data);
});

const openEditor = async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdvancedMenuManager /></MemoryRouter>);
    await screen.findByRole('button', { name: '구분선 추가' });
};

it('선택한 메뉴 아래에 링크 없는 구분선을 추가하고 전용 설정으로 간격과 선 모양을 저장한다', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('checkbox', { name: '출력 관리 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '구분선 추가' }));
    await screen.findByRole('heading', { name: '구분선 설정' });
    expect(screen.queryByPlaceholderText('메뉴명을 입력하세요')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('예: /dashboard')).not.toBeInTheDocument();
    await waitFor(() => expect(menuServiceV11.saveMenuConfig).toHaveBeenCalledTimes(1));
    const added = (menuServiceV11.saveMenuConfig as jest.Mock).mock.calls[0][0].admin.menu;
    expect(added.map((item: { text: string }) => item.text)).toEqual(['출력 관리', '-', '급여 관리']);
    expect(added[1]).not.toHaveProperty('path');
    fireEvent.click(screen.getByRole('button', { name: '점선' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '점선' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('button', { name: '넓게' }));
    await waitFor(() => {
        const calls = (menuServiceV11.saveMenuConfig as jest.Mock).mock.calls;
        expect(calls[calls.length - 1][0].admin.menu[1]).toMatchObject({ text: '-', dividerStyle: 'dashed', dividerSpacing: 'relaxed' });
    });
    expect(screen.getByRole('separator', { name: '메뉴 구분선' })).toHaveStyle({ padding: '22px 12px' });
    fireEvent.change(screen.getByRole('textbox', { name: '구분선 제목' }), { target: { value: '현장 관리' } });
    await waitFor(() => {
        const calls = (menuServiceV11.saveMenuConfig as jest.Mock).mock.calls;
        expect(calls[calls.length - 1][0].admin.menu[1]).toMatchObject({ text: '-', dividerTitle: '현장 관리' });
    });
    expect(screen.getByRole('separator', { name: '현장 관리 구분선' })).toHaveTextContent('현장 관리');
    fireEvent.click(screen.getByRole('checkbox', { name: '구분선 표시' }));
    await waitFor(() => expect(screen.queryByRole('separator')).not.toBeInTheDocument());
});

it('하위 메뉴 선택 시 같은 그룹에 추가하고 실행 취소로 원래 구조를 복원한다', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('checkbox', { name: '급여 내역 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '구분선 추가' }));
    await screen.findByRole('heading', { name: '구분선 설정' });
    await waitFor(() => expect(menuServiceV11.saveMenuConfig).toHaveBeenCalledTimes(1));
    expect((menuServiceV11.saveMenuConfig as jest.Mock).mock.calls[0][0].admin.menu[1].sub[1].text).toBe('-');
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '구분선 설정 열기' })).not.toBeInTheDocument());
});

it('상단 아이콘에는 구분선 추가 도구를 표시하지 않는다', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: '상단 아이콘' }));
    expect(screen.queryByRole('button', { name: '구분선 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '구분선 바로 추가' })).not.toBeInTheDocument();
});
