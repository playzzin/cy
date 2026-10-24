import type { MenuItem, SiteDataType } from '../types/menu';

const path = '/payroll/bank-transfer';
const label = '국민은행 송금';
const contains = (items: Array<MenuItem | string>): boolean => items.some(item => typeof item === 'string' ? item === label : item.path === path || item.text === label || contains(item.sub ?? []));

/** Add the transfer workspace beside payroll in memory, retaining the existing payroll access restrictions. */
export function ensureBankTransferMenu(config: SiteDataType): void {
    Object.values(config).forEach(site => {
        if (!Array.isArray(site.menu) || contains(site.menu) || contains(site.trash ?? []) || site.deletedItems?.some(item => item === path || item === label)) return;
        const insert = (items: Array<MenuItem | string>): boolean => {
            const index = items.findIndex(item => typeof item === 'string' ? item === '월급제' : item.path === '/payroll/monthly-wage');
            if (index >= 0) {
                const existing = items[index];
                items.splice(index + 1, 0, { text: label, path, icon: 'fa-building-columns',
                    ...(typeof existing !== 'string' && existing.roles ? { roles: [...existing.roles] } : {}),
                    ...(typeof existing !== 'string' && existing.hide !== undefined ? { hide: existing.hide } : {}),
                });
                return true;
            }
            return items.some(item => typeof item !== 'string' && !!item.sub && insert(item.sub));
        };
        insert(site.menu);
    });
}
