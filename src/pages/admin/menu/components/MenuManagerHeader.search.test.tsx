import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MenuManagerHeader from './MenuManagerHeader';
import { SiteDataType } from '../../../../types/menu';
import { SIDEBAR_FONT_IDS } from '../../../../constants/sidebarFonts';

it('필요할 때 글꼴 검색을 열고 선택하면 현재 직책의 글꼴만 저장한다', () => {
    const data: SiteDataType = { pos_leader: { name: '팀장', icon: 'fa-user', menu: [] } };
    const onUpdate = jest.fn();
    const props = { menuData: data, selectedSite: 'pos_leader', onSelectSite: jest.fn(), onUpdateMenuData: onUpdate, onOpenSiteManager: jest.fn(), onOpenRoleManager: jest.fn() };
    const view = render(<MenuManagerHeader {...props} />);
    const picker = screen.getByRole('combobox', { name: '좌측 메뉴 기본 글꼴' });
    expect(SIDEBAR_FONT_IDS).toHaveLength(43);
    expect(within(picker).getAllByRole('group')).toHaveLength(5);
    expect(within(picker).getAllByRole('option').map(option => (option as HTMLOptionElement).value)).toEqual(['', ...SIDEBAR_FONT_IDS]);
    expect(within(within(picker).getByRole('group', { name: '손글씨' })).getByRole('option', { name: '나눔손글씨 펜' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '좌측 메뉴 기본 글꼴 검색' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const search = screen.getByRole('searchbox', { name: '좌측 메뉴 기본 글꼴 검색' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'S U I T' } });
    expect(within(picker).getAllByRole('option')).toHaveLength(2);
    expect(within(picker).getByRole('option', { name: '수트 (SUIT)' })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '손글씨' } });
    expect(within(picker).getAllByRole('group')).toHaveLength(1);
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.change(picker, { target: { value: 'nanum-pen' } });
    const updated = onUpdate.mock.calls[0][0];
    expect(updated.pos_leader.sidebarFontPreset).toBe('nanum-pen');
    view.rerender(<MenuManagerHeader {...props} menuData={updated} />);
    expect(picker.style.fontFamily).toContain('Nanum Pen Script');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    const reopened = screen.getByRole('searchbox', { name: '좌측 메뉴 기본 글꼴 검색' });
    fireEvent.change(reopened, { target: { value: '일치하지 않는 이름' } });
    expect(screen.getByText('일치하는 글꼴이 없습니다.')).toHaveAttribute('role', 'status');
    expect(picker).toHaveValue('nanum-pen');
    fireEvent.keyDown(reopened, { key: 'Escape' });
    expect(toggle).toHaveFocus();
    expect(within(picker).getAllByRole('option')).toHaveLength(44);
    expect(onUpdate).toHaveBeenCalledTimes(1);
});

it('테마 한 번으로 직책 색상만 변경하고 개별 변경·기본 복원은 글꼴과 메뉴 예외를 유지한다', () => {
    const data: SiteDataType = {
        pos_ceo: { name: 'CEO', icon: 'fa-user', sidebarFontPreset: 'gamja-flower', menu: [{ text: '보고서', backgroundColor: '#123456' }] },
        pos_leader: { name: '팀장', icon: 'fa-user', menu: [] }
    };
    const onUpdate = jest.fn();
    const props = { menuData: data, selectedSite: 'pos_ceo', onSelectSite: jest.fn(), onUpdateMenuData: onUpdate, onOpenSiteManager: jest.fn(), onOpenRoleManager: jest.fn() };
    const view = render(<MenuManagerHeader {...props} />);
    const theme = screen.getByRole('button', { name: '네이비' });
    fireEvent.click(theme);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const navy = onUpdate.mock.calls[0][0];
    expect(navy.pos_ceo).toEqual({ ...data.pos_ceo, sidebarBackgroundColor: '#17243a', sidebarSelectedBackgroundColor: '#30486b', sidebarAccentColor: '#a8ceff' });
    expect(navy.pos_leader).toEqual(data.pos_leader);
    view.rerender(<MenuManagerHeader {...props} menuData={navy} />);
    expect(theme).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('좌측 메뉴 배경색'), { target: { value: '#112233' } });
    const custom = onUpdate.mock.calls[1][0];
    expect(custom.pos_ceo).toEqual({ ...navy.pos_ceo, sidebarBackgroundColor: '#112233' });
    view.rerender(<MenuManagerHeader {...props} menuData={custom} />);
    expect(theme).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '기본' }));
    expect(onUpdate.mock.calls[2][0]).toEqual(data);
});

it('선택한 사이트·직책의 검색 설정만 변경하고 기존 메뉴와 다른 설정은 보존한다', () => {
    const data: SiteDataType = {
        admin: { name: '전체', icon: 'fa-list', menu: [{ text: '홈', path: '/' }] },
        pos_leader: { name: '팀장', icon: 'fa-user', menu: [], headerActions: [{ text: '알림', path: '/messages' }] }
    };
    const onUpdate = jest.fn();
    const props = { menuData: data, selectedSite: 'pos_leader', onSelectSite: jest.fn(), onUpdateMenuData: onUpdate, onOpenSiteManager: jest.fn(), onOpenRoleManager: jest.fn() };
    const view = render(<MenuManagerHeader {...props} />);
    expect(screen.getByRole('switch', { name: '좌측 메뉴 검색 사용' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch'));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated).toEqual({ ...data, pos_leader: { ...data.pos_leader, sidebarSearchEnabled: true } });
    expect(data.pos_leader.sidebarSearchEnabled).toBeUndefined();
    view.rerender(<MenuManagerHeader {...props} menuData={updated} />);
    expect(screen.getByRole('switch')).toBeChecked();
    fireEvent.click(screen.getByRole('switch'));
    expect(onUpdate.mock.calls[1][0].pos_leader.sidebarSearchEnabled).toBe(false);
    view.rerender(<MenuManagerHeader {...props} menuData={updated} selectedSite="admin" />);
    expect(screen.getByRole('switch')).not.toBeChecked();
});
