import type { SiteDataType } from '../types/menu';

export type SidebarSide = 'left' | 'right';
const key = (value: string = '') => value.trim().toLowerCase().replace(/^pos[_-]/, '').replace(/[\s_-]/g, '');
const rightMenuPositions = new Set([
    '팀장', 'leader', 'teamlead', 'teamleader',
    '반장', 'foreman', '작업자', 'worker',
    '임대사', 'rental', 'rentalcompany',
    '발주사', '건설', '건설사', '원청', 'client', 'clientcompany', 'constructioncompany',
    '소개소', '소개자', 'referral', 'recruiting', 'agency',
]);

/** Follow the displayed position menu, including configured IDs and renamed partner menus. */
export function getSidebarSide(effectiveSite: string, config: SiteDataType | null): SidebarSide {
    // Site layers and the full/admin menu keep their existing layout.
    if (!effectiveSite.startsWith('pos_')) return 'left';
    const position = config?.admin?.positionConfig?.find(item => key(item.id) === key(effectiveSite));
    return [effectiveSite, position?.name, config?.[effectiveSite]?.name]
        .some(value => rightMenuPositions.has(key(value))) ? 'right' : 'left';
}
