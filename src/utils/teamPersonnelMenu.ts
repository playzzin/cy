import type { MenuItem, SiteDataType } from '../types/menu';

export const TEAM_PERSONNEL_MENU_ITEMS: MenuItem[] = [
    { text: '작업자정보', path: '/manpower/team-worker-detail', icon: 'fa-address-card' },
    { text: '급여명세서', path: '/manpower/team-worker-payslip', icon: 'fa-file-invoice-dollar' },
    { text: '출력일보', path: '/manpower/team-worker-daily-report', icon: 'fa-calendar-days' },
    { text: '신규작업자등록', path: '/manpower/team-worker-requests', icon: 'fa-user-plus' },
];

const normalize = (value?: string) => String(value ?? '').replace(/\s/g, '');
const isTeamLead = (value?: string) => ['팀장', 'team_leader', 'teamleader'].includes(normalize(value).toLowerCase());

/** Upgrade existing team-leader personnel menus in memory without writing settings. */
export const ensureTeamPersonnelMenu = (config: SiteDataType): void => {
    const teamLeadKeys = new Set((config.admin?.positionConfig ?? [])
        .filter(position => isTeamLead(position.name))
        .map(position => `pos_${position.id}`));

    Object.entries(config).forEach(([key, site]) => {
        if (!teamLeadKeys.has(key) && !isTeamLead(site.name) && !isTeamLead(key.replace(/^pos_/, ''))) return;

        const upgrade = (items: (MenuItem | string)[]) => {
            items.forEach(item => {
                if (typeof item === 'string') return;
                if (normalize(item.text) !== '인원관리') {
                    if (item.sub) upgrade(item.sub);
                    return;
                }

                const children = (item.sub ?? []).map(child => typeof child === 'string' ? { text: child } : child);
                const matches = (child: MenuItem, target: MenuItem) => child.path?.split(/[?#]/)[0] === target.path
                    || normalize(child.text) === normalize(target.text)
                    || (target === TEAM_PERSONNEL_MENU_ITEMS[0] && normalize(child.text) === '인원현황');
                const profile = children.find(child => matches(child, TEAM_PERSONNEL_MENU_ITEMS[0]));
                item.sub = TEAM_PERSONNEL_MENU_ITEMS.map((target, index) => {
                    const existing = children.find(child => matches(child, target));
                    return {
                        ...(profile?.roles ? { roles: [...profile.roles] } : {}),
                        ...(profile?.hide !== undefined ? { hide: profile.hide } : {}),
                        ...target,
                        ...existing,
                        id: existing?.id || `${item.id || key + '-personnel'}-${index}`,
                        text: target.text,
                        path: target.path,
                    };
                });
                // Preserve unrelated custom links when updating older configurations.
                item.sub.push(...children.filter(child => !TEAM_PERSONNEL_MENU_ITEMS.some(target => matches(child, target))));
                delete item.path;
            });
        };
        upgrade(site.menu);
    });
};
