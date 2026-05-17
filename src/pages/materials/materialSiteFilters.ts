import { Site } from '../../services/siteService';
import { Inventory } from '../../types/materials';

export type MaterialSiteStatusFilter = 'active' | 'completed' | 'all';

const normalizeCompanyText = (value: unknown): string =>
    String(value ?? '')
        .replace(/\s+/g, '')
        .replace(/[()（）㈜주식회사]/g, '')
        .toLowerCase();

const CHEONGYEON_COMPANY_KEYS = ['청연이엔지', '청연eng', 'cheongyeoneng', 'cyeng'];

export const isCheongyeonMaterialSite = (site: Site): boolean => {
    const companyNames = [
        site.companyName,
        site.constructorCompanyName,
    ];

    return companyNames.some((name) => {
        const normalized = normalizeCompanyText(name);
        return CHEONGYEON_COMPANY_KEYS.some((key) => normalized.includes(normalizeCompanyText(key)));
    });
};

export const getSiteStatusLabel = (status: Site['status'] | string | undefined): string => {
    if (status === 'completed') return '마감';
    if (status === 'planned') return '예정';
    return '진행';
};

export const filterSitesByMaterialStatus = (
    sites: Site[],
    statusFilter: MaterialSiteStatusFilter = 'active'
): Site[] => (
    statusFilter === 'all'
        ? sites.filter((site) => site.status === 'active' || site.status === 'completed')
        : sites.filter((site) => site.status === statusFilter)
);

export const filterCheongyeonMaterialSites = (
    sites: Site[],
    statusFilter: MaterialSiteStatusFilter = 'active'
): Site[] =>
    sites
        .filter(isCheongyeonMaterialSite)
        .filter((site) => (
            statusFilter === 'all'
                ? site.status === 'active' || site.status === 'completed'
                : site.status === statusFilter
        ))
        .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'ko'));

export const createSiteIdSet = (sites: Site[]): Set<string> =>
    new Set(sites.map((site) => site.id).filter(Boolean) as string[]);

export const filterInventoriesBySites = (inventories: Inventory[], siteIds: Set<string>): Inventory[] =>
    inventories.filter((inventory) => siteIds.has(inventory.siteId));
