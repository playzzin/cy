import type { MenuItem, SiteDataType } from '../types/menu';
import { getErpRoleGroupsForRoles } from '../security/erpAccessPolicy';

export const DELEGATED_RECEIPTS_MENU = {
    text: '노무 입금 확인',
    path: '/payroll/delegated-receipts',
    icon: 'fa-money-bill-transfer',
};

const LEGACY_MENU_TEXT = '위임금 입금 확인';
const renameLegacyItems = (items: (MenuItem | string)[]): void => {
    items.forEach((item, index) => {
        if (typeof item === 'string') {
            if (item === LEGACY_MENU_TEXT) items[index] = DELEGATED_RECEIPTS_MENU.text;
            return;
        }
        if (item.text === LEGACY_MENU_TEXT) item.text = DELEGATED_RECEIPTS_MENU.text;
        if (Array.isArray(item.sub)) renameLegacyItems(item.sub);
    });
};

const containsMenu = (items: (MenuItem | string)[]): boolean => items.some(item =>
    typeof item === 'string'
        ? item === DELEGATED_RECEIPTS_MENU.text
        : item.text === DELEGATED_RECEIPTS_MENU.text
            || item.path?.split(/[?#]/)[0] === DELEGATED_RECEIPTS_MENU.path
            || (Array.isArray(item.sub) && containsMenu(item.sub))
);

/** Enrich the in-memory menu only; no configuration writes occur here. */
export const ensureDelegatedReceiptsMenu = (config: SiteDataType): void => {
    Object.entries(config).forEach(([key, site]) => {
        renameLegacyItems(site.menu);
        renameLegacyItems(site.trash || []);
        renameLegacyItems(site.headerActions || []);
        const role = key.replace(/^pos_/, '');
        const groups = getErpRoleGroupsForRoles([role, site.name]);
        if (key !== 'pos_ceo' && !groups.some(group => ['admin', 'finance', 'payroll'].includes(group))) return;
        if (site.deletedItems?.some(value => [LEGACY_MENU_TEXT, DELEGATED_RECEIPTS_MENU.text, DELEGATED_RECEIPTS_MENU.path].includes(value))) return;
        if (containsMenu(site.menu) || containsMenu(site.trash || [])) return;

        const findPayroll = (items: (MenuItem | string)[]): MenuItem | undefined => {
            for (const item of items) {
                if (typeof item === 'string') continue;
                if (item.text.replace(/\s/g, '') === '급여관리') return item;
                const child = item.sub && findPayroll(item.sub);
                if (child) return child;
            }
            return undefined;
        };
        const payroll = findPayroll(site.menu);
        if (payroll) payroll.sub = [...(payroll.sub || []), { ...DELEGATED_RECEIPTS_MENU }];
    });
};
