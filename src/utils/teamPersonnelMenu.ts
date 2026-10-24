import type { MenuItem, SiteDataType } from '../types/menu';
import { hideTeamWorkflowLink } from './teamWorkflowPolicy';
import { teamAccountApprovalEnabled } from './teamAccountApprovalFeature';

export const TEAM_PERSONNEL_MENU_ITEMS: MenuItem[] = [
    { text: '작업자정보', path: '/manpower/team-worker-detail', icon: 'fa-address-card' },
    { text: '근무내역', path: '/manpower/team-worker-history', icon: 'fa-calendar-days' },
    { text: '급여명세서', path: '/manpower/team-worker-payslip', icon: 'fa-file-invoice-dollar' },
    { text: '신규작업자등록', path: '/manpower/team-worker-requests', icon: 'fa-user-plus' },
    { text: '작업자 요약', path: '/manpower/summary', icon: 'fa-users' },
    { text: '일정확정보드', path: '/assignment/schedule-confirmation', icon: 'fa-calendar-check' },
];

export const TEAM_SITE_MENU_ITEMS: MenuItem[] = [
    { text: '현장정보', path: '/manpower/site-responsible-detail', icon: 'fa-building' },
    { text: '출력일보', path: '/manpower/site-daily-report', icon: 'fa-calendar-days' },
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

        const prune = (items: (MenuItem | string)[]): MenuItem[] => items.flatMap(value => {
            const item = typeof value === 'string' ? { text: value } : value;
            if (hideTeamWorkflowLink(item)) return [];
            if (item.path === '/manpower/team-account-approvals' && !teamAccountApprovalEnabled()) return [];
            if (item.sub) {
                item.sub = prune(item.sub);
                if (!item.sub.length && !item.path) return [];
            }
            return [item];
        });
        site.menu = prune(site.menu);
        if (site.headerActions) site.headerActions = prune(site.headerActions);
        const hasPersonnel = (items: (MenuItem | string)[]): boolean => items.some(item => typeof item !== 'string'
            && (normalize(item.text) === '인원관리' || Boolean(item.sub && hasPersonnel(item.sub))));
        if (!hasPersonnel(site.menu)) site.menu.push({ text: '인원관리', icon: 'fa-users', sub: [] });
        const targets = [...TEAM_PERSONNEL_MENU_ITEMS, ...(teamAccountApprovalEnabled() ? [{ text: '팀원 계정 승인', path: '/manpower/team-account-approvals', icon: 'fa-user-check' }] : [])];

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
                item.sub = targets.map((target, index) => {
                    const existing = children.find(child => matches(child, target));
                    return {
                        ...(profile?.roles ? { roles: [...profile.roles] } : {}),
                        ...(profile?.hide !== undefined ? { hide: profile.hide } : {}),
                        ...target,
                        ...existing,
                        id: existing?.id || `${item.id || key + '-personnel'}-${target.path?.split('/').pop() || index}`,
                        text: target.text,
                        path: target.path,
                    };
                });
                // Preserve unrelated custom links when updating older configurations.
                item.sub.push(...children.filter(child => !targets.some(target => matches(child, target))));
                delete item.path;
            });
        };
        upgrade(site.menu);

        const oilPath = '/support/vehicles/oil-cycle';
        const hasOilMenu = (items: (MenuItem | string)[]): boolean => items.some(item => typeof item !== 'string'
            && (item.path?.split(/[?#]/)[0] === oilPath || Boolean(item.sub && hasOilMenu(item.sub))));
        if (!hasOilMenu(site.menu)) {
            const oilMenu: MenuItem = { id: `${key}-engine-oil-cycle`, text: '엔진오일 주기', path: oilPath, icon: 'fa-oil-can' };
            const supportGroup = site.menu.find(item => ['지원관리', '차량관리'].includes(normalize(item.text)) && item.sub);
            if (supportGroup?.sub) supportGroup.sub.push(oilMenu);
            else site.menu.push(oilMenu);
        }

        let foundSiteMenu = false;
        const upgradeSites = (items: (MenuItem | string)[]) => {
            items.forEach(item => {
                if (typeof item === 'string') return;
                if (normalize(item.text) !== '현장관리' && (item.text === '현장정보'
                    || item.path?.split(/[?#]/)[0] !== '/manpower/site-responsible-detail')) {
                    if (item.sub) upgradeSites(item.sub);
                    return;
                }
                foundSiteMenu = true;
                const children = (item.sub ?? []).map(child => typeof child === 'string' ? { text: child } : child);
                const matches = (child: MenuItem, target: MenuItem) => child.path?.split(/[?#]/)[0] === target.path
                    || normalize(child.text) === normalize(target.text);
                item.sub = TEAM_SITE_MENU_ITEMS.map(target => {
                    const existing = children.find(child => matches(child, target));
                    return {
                        ...(item.roles ? { roles: [...item.roles] } : {}),
                        ...(item.hide !== undefined ? { hide: item.hide } : {}),
                        ...target, ...existing,
                        id: existing?.id || `${item.id || key + '-sites'}-${target.path?.split('/').pop()}`,
                        text: target.text, path: target.path,
                    };
                });
                item.sub.push(...children.filter(child => !TEAM_SITE_MENU_ITEMS.some(target => matches(child, target))));
                item.text = '현장관리';
                delete item.path;
            });
        };
        upgradeSites(site.menu);
        if (!foundSiteMenu) {
            const group: MenuItem = { id: `${key}-sites`, text: '현장관리', icon: 'fa-building', sub: [] };
            site.menu.push(group);
            upgradeSites([group]);
        }

        const hasMemoMenu = (items: (MenuItem | string)[]): boolean => items.some(item => typeof item !== 'string'
            && (item.path?.split(/[?#]/)[0].replace(/\/+$/, '') === '/memos' || Boolean(item.sub && hasMemoMenu(item.sub))));
        if (!hasMemoMenu(site.menu)) {
            site.menu.push({ id: `${key}-smart-memo`, text: '스마트 메모', path: '/memos', icon: 'fa-sticky-note' });
        }
    });
};
