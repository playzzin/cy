import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdvancedMenuManager from './AdvancedMenuManager';
import { menuServiceV11 } from '../../../services/menuServiceV11';
import type { SiteDataType } from '../../../types/menu';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../../contexts/SiteModeContext', () => ({ useSiteMode: () => ({ positions: [], changePosition: jest.fn() }) }));
jest.mock('../../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../../../services/menuServiceV11', () => ({ menuServiceV11: { subscribe: jest.fn(), getMenuConfig: jest.fn(), saveMenuConfig: jest.fn() } }));
jest.mock('./components/RoleManager', () => () => null);
jest.mock('./components/SiteManager', () => () => null);
jest.mock('./components/PositionMenuCopyModal', () => () => null);
jest.mock('./components/IconPicker', () => () => null);
jest.mock('./components/ToolboxPanel', () => () => null);

const config = (): SiteDataType => ({
    admin: { name: '전체', icon: '', menu: [], positionConfig: [
        { id: 'dev', name: 'DEV', icon: '', color: '' },
        { id: 'leader', name: '팀장', icon: '', color: '' },
    ] },
    pos_dev: { name: 'DEV', icon: '', menu: [{ id: 'own', text: 'DEV 도구' }] },
    pos_leader: { name: '팀장', icon: '', menu: [{ id: 'report', text: '일보 관리', sub: [{ id: 'write', text: '일보 작성', path: '/daily' }] }] },
});
let receive: (data: SiteDataType) => void;
let stored: SiteDataType;
const unsubscribe = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    stored = config();
    (menuServiceV11.subscribe as jest.Mock).mockImplementation(callback => { receive = callback; callback(stored); return unsubscribe; });
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementation(async data => { stored = data; receive(data); return data; });
    (menuServiceV11.getMenuConfig as jest.Mock).mockImplementation(async () => stored);
});
const openEditor = () => render(<MemoryRouter initialEntries={['/admin/menu-manager?site=pos_dev']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AdvancedMenuManager /></MemoryRouter>);
const openLinked = () => fireEvent.click(screen.getByRole('button', { name: '팀장 연결 메뉴 펼치기' }));

it('DEV 연결 메뉴와 해당 직책 양쪽에서 수정하고 실시간 갱신·연결 해제를 처리한다', async () => {
    const view = openEditor();
    openLinked();
    fireEvent.click(screen.getByRole('checkbox', { name: '일보 작성 선택' }));
    fireEvent.change(screen.getByPlaceholderText('메뉴명을 입력하세요'), { target: { value: 'DEV에서 수정' } });
    await waitFor(() => expect(stored.pos_leader.menu[0].sub![0]).toMatchObject({ id: 'write', text: 'DEV에서 수정' }));
    expect(stored.pos_dev.menu).toEqual([{ id: 'own', text: 'DEV 도구' }]);
    expect(JSON.stringify(stored)).not.toContain('__linked_position__');
    fireEvent.click(screen.getByRole('button', { name: '팀장' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'DEV에서 수정 선택' }));
    fireEvent.change(screen.getByPlaceholderText('메뉴명을 입력하세요'), { target: { value: '직책에서 수정' } });
    await waitFor(() => expect(stored.pos_leader.menu[0].sub![0]).toMatchObject({ text: '직책에서 수정' }));
    fireEvent.click(screen.getByRole('button', { name: 'DEV' }));
    openLinked();
    expect(screen.getByRole('checkbox', { name: '직책에서 수정 선택' })).toBeInTheDocument();
    const remote = JSON.parse(JSON.stringify(stored));
    remote.pos_leader.menu[0].sub[0].text = '다른 창 수정';
    act(() => receive(remote));
    expect(screen.getByRole('checkbox', { name: '다른 창 수정 선택' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: '직책별 메뉴 연결 사용' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /팀장 연결 메뉴/ })).not.toBeInTheDocument());
    expect(stored.pos_leader.menu[0].sub![0]).toMatchObject({ text: '다른 창 수정' });
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
});

it('DEV에서 추가·삭제한 하위 항목은 연결된 원본에 저장하고 직책 그룹 삭제는 제공하지 않는다', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    openEditor();
    openLinked();
    fireEvent.click(screen.getByRole('checkbox', { name: '일보 작성 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '구분선 추가' }));
    await waitFor(() => expect(stored.pos_leader.menu[0].sub!.map(i => typeof i === 'string' ? i : i.text)).toEqual(['일보 작성', '-']));
    fireEvent.click(screen.getAllByTitle('단일 항목 삭제').slice(-1)[0]);
    await waitFor(() => expect(stored.pos_leader.menu[0].sub!).toHaveLength(1));
    expect(stored.pos_dev.menu).toHaveLength(1);
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'));
    await waitFor(() => expect(stored.pos_leader.menu[0].sub!).toHaveLength(2));
    confirm.mockRestore();
});

it('연결 메뉴 여러 개 선택 후 구분선을 추가해도 해당 직책 원본에 남는다', async () => {
    openEditor();
    openLinked();
    fireEvent.click(screen.getByRole('checkbox', { name: '일보 관리 선택' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '일보 작성 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '구분선 추가' }));
    await waitFor(() => expect(stored.pos_leader.menu).toHaveLength(2));
    expect(stored.pos_leader.menu[1]).toMatchObject({ text: '-' });
    expect(stored.pos_dev.menu).toEqual(config().pos_dev.menu);
    expect(JSON.stringify(stored)).not.toContain('__linked_position__');
});

it('행의 숨기기 버튼이 원본을 수정하고 실행 취소로 복원된다', async () => {
    openEditor();
    openLinked();
    fireEvent.click(screen.getByRole('button', { name: '일보 작성 숨기기' }));
    await waitFor(() => expect(stored.pos_leader.menu[0].sub![0]).toMatchObject({ hide: true }));
    expect(screen.getByRole('button', { name: '일보 작성 표시하기' })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'));
    await waitFor(() => expect(stored.pos_leader.menu[0].sub![0]).not.toHaveProperty('hide', true));
    expect(screen.getByRole('button', { name: '일보 작성 숨기기' })).toBeInTheDocument();
});

it('상위·하위 이동을 실행 취소할 수 있고 연결 직책 밖으로 이동하지 않는다', async () => {
    openEditor();
    openLinked();
    expect(screen.getAllByTitle('상위로 이동 (Outdent)')).toHaveLength(1);
    fireEvent.click(screen.getByTitle('상위로 이동 (Outdent)'));
    await waitFor(() => expect(stored.pos_leader.menu).toHaveLength(2));
    expect(screen.queryByTitle('상위로 이동 (Outdent)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'));
    await waitFor(() => expect(stored.pos_leader.menu[0].sub).toHaveLength(1));
    fireEvent.click(screen.getByTitle('상위로 이동 (Outdent)'));
    await waitFor(() => expect(stored.pos_leader.menu).toHaveLength(2));
    fireEvent.click(screen.getByTitle('하위로 이동 (Indent)'));
    await waitFor(() => expect(stored.pos_leader.menu).toHaveLength(1));
    fireEvent.click(screen.getByTitle('실행 취소 (Undo)'));
    await waitFor(() => expect(stored.pos_leader.menu).toHaveLength(2));
    expect(stored.pos_dev.menu).toEqual(config().pos_dev.menu);
});

it('연결 해제로 사라진 선택을 해제하고 다음 추가는 DEV에 적용한다', async () => {
    openEditor();
    openLinked();
    fireEvent.click(screen.getByRole('checkbox', { name: '일보 작성 선택' }));
    fireEvent.click(screen.getByRole('switch', { name: '직책별 메뉴 연결 사용' }));
    await waitFor(() => expect(stored.pos_dev.linkedPositionMenusEnabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '구분선 추가' }));
    await waitFor(() => expect(stored.pos_dev.menu).toHaveLength(2));
    expect(stored.pos_leader.menu).toEqual(config().pos_leader.menu);
});
