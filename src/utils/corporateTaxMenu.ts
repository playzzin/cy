import type { MenuItem, SiteDataType } from '../types/menu';

export const CORPORATE_TAX_PATH = '/payroll/corporate-tax';
const compact = (text: string) => text.replace(/\s+/g, '');
const isCorporateTaxName = (text: string) => ['법인세', '법인세관리'].includes(compact(text));
const contains = (items: Array<MenuItem | string>): boolean => items.some(item => typeof item === 'string'
    ? isCorporateTaxName(item) : item.path?.split(/[?#]/)[0] === CORPORATE_TAX_PATH || isCorporateTaxName(item.text) || contains(item.sub || []));

const rename = (items: Array<MenuItem | string>): void => items.forEach((item, index) => {
    if (typeof item === 'string') {
        if (isCorporateTaxName(item)) items[index] = '법인세 관리';
        return;
    }
    if (item.path?.split(/[?#]/)[0] === CORPORATE_TAX_PATH || isCorporateTaxName(item.text)) item.text = '법인세 관리';
    if (item.sub) rename(item.sub);
});

/** 저장 메뉴를 읽을 때만 보완. 기존 세무 접근 범위를 유지하고 DB를 자동 수정하지 않는다. */
export function ensureCorporateTaxMenu(config: SiteDataType): void {
    Object.values(config).forEach(site => {
        if (!Array.isArray(site.menu)) return;
        rename(site.menu);
        if (contains(site.menu) || contains(site.trash || []) || site.deletedItems?.some(item => item === CORPORATE_TAX_PATH || isCorporateTaxName(item))) return;
        const insert = (items: Array<MenuItem | string>): boolean => items.some(item => {
            if (typeof item === 'string') return false;
            if (compact(item.text) === '세무관리' && Array.isArray(item.sub)) {
                const ledger = item.sub.find(child => typeof child === 'string' ? compact(child) === '매입매출관리' : child.path === '/payroll/workbook-ledger');
                const scope = typeof ledger === 'object' ? ledger : item;
                item.sub.push({ id: 'corporate-tax', text: '법인세 관리', path: CORPORATE_TAX_PATH, icon: 'fa-calculator',
                    ...(scope.roles ? { roles: [...scope.roles] } : {}), ...(scope.hide !== undefined ? { hide: scope.hide } : {}) });
                return true;
            }
            return item.sub ? insert(item.sub) : false;
        });
        insert(site.menu);
    });
}
