import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuManagerHeader from './MenuManagerHeader';
import { SiteDataType } from '../../../../types/menu';

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
