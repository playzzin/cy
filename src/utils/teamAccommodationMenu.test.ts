import { ensureTeamAccommodationDevMenu, TEAM_ACCOMMODATION_PATH } from './teamAccommodationMenu';
import { MENU_PATHS } from '../constants/menuPaths';
import type { SiteDataType } from '../types/menu';

test('DEV 구성메뉴에만 등록하며 팀장과 다른 직책 메뉴를 보존한다', () => {
    const config: SiteDataType = {
        admin: { name: '관리', icon: '', menu: [], positionConfig: [{ id: 'custom-dev', name: 'DEV', icon: '', color: '' }] },
        'pos_custom-dev': { name: '개발자', icon: '', menu: [{ text: '구성 메뉴', sub: ['기존 페이지'] }] },
        pos_leader: { name: '팀장', icon: '', menu: [{ text: '기존 팀장 메뉴', path: '/dashboard' }] },
        pos_manager: { name: '매니저', icon: '', menu: [] },
    };
    const leaderBefore = JSON.stringify(config.pos_leader);
    ensureTeamAccommodationDevMenu(config);
    ensureTeamAccommodationDevMenu(config);
    expect(config['pos_custom-dev'].menu[0].sub).toHaveLength(2);
    expect(config['pos_custom-dev'].menu[0].sub?.[1]).toEqual(expect.objectContaining({ path: TEAM_ACCOMMODATION_PATH }));
    expect(JSON.stringify(config.pos_leader)).toBe(leaderBefore);
    expect(config.pos_manager.menu).toEqual([]);
    expect(MENU_PATHS['우리 팀 숙소 배정']).toBe(TEAM_ACCOMMODATION_PATH);
});

test('DEV가 메뉴에서 제거하거나 이미 다른 위치에 등록한 페이지는 중복 추가하지 않는다', () => {
    const config: SiteDataType = { pos_dev: { name: 'DEV', icon: '', menu: [], deletedItems: [TEAM_ACCOMMODATION_PATH] } };
    ensureTeamAccommodationDevMenu(config);
    expect(config.pos_dev.menu).toEqual([]);
    config.pos_dev.deletedItems = [];
    config.pos_dev.menu = [{ text: '사용자 지정', path: TEAM_ACCOMMODATION_PATH }];
    ensureTeamAccommodationDevMenu(config);
    expect(config.pos_dev.menu).toHaveLength(1);
});
