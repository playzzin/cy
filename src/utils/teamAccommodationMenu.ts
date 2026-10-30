import type { MenuItem, SiteDataType } from '../types/menu';
import { isDevPositionSite } from './linkedPositionMenus';
import { MENU_PATHS } from '../constants/menuPaths';

export const TEAM_ACCOMMODATION_PATH = '/assignment/team-accommodation';
export const TEAM_ACCOMMODATION_LABEL = '우리 팀 숙소 배정';

/** DEV의 구성메뉴만 보완한다. 직책별 메뉴는 메뉴 편집기에서 명시적으로 등록한다. */
export function ensureTeamAccommodationDevMenu(config: SiteDataType): void {
    const contains = (items: (MenuItem | string)[]): boolean => items.some(item =>
        (typeof item === 'string' ? MENU_PATHS[item] : item.path || MENU_PATHS[item.text]) === TEAM_ACCOMMODATION_PATH
        || (typeof item !== 'string' && contains(item.sub || [])));
    Object.entries(config).forEach(([key, site]) => {
        if (!isDevPositionSite(config, key) || contains(site.menu) || contains(site.trash || [])
            || site.deletedItems?.some(item => [TEAM_ACCOMMODATION_PATH, TEAM_ACCOMMODATION_LABEL].includes(item))) return;
        let group = site.menu.find(item => item.text.replace(/\s/g, '') === '구성메뉴');
        if (!group) {
            group = { id: `${key}-configuration`, text: '구성메뉴', icon: 'fa-layer-group', sub: [] };
            site.menu.push(group);
        }
        group.sub = [...(group.sub || []), {
            id: `${key}-team-accommodation`, text: TEAM_ACCOMMODATION_LABEL,
            path: TEAM_ACCOMMODATION_PATH, icon: 'fa-house',
        }];
    });
}
