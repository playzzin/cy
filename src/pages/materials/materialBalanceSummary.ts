import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import type { Site } from '../../services/siteService';

export const UNASSIGNED_BALANCE_RENTAL = 'unassigned';
const text = (value: unknown) => String(value ?? '').trim();
const normalized = (value: unknown) => text(value).replace(/\s+/g, '').toLowerCase();
// Suppress floating point noise without rounding legitimate fractional quantities.
const quantity = (value: number) => Number(value.toFixed(9));

export interface MaterialSiteBalance {
    key: string;
    siteId: string;
    siteName: string;
    constructionKey: string;
    constructionName: string;
    rentalKey: string;
    rentalName: string;
    rentalNeedsReview: boolean;
    category: string;
    itemName: string;
    spec: string;
    unit: string;
    inbound: number;
    outbound: number;
    balance: number;
    transactions: MaterialTransactionRow[];
}

export type MaterialBalanceGrouping = 'site' | 'rental';
export interface MaterialBalanceSubgroup {
    key: string;
    name: string;
    siteName: string;
    rentalName: string;
    rows: MaterialSiteBalance[];
}
export interface MaterialBalanceGroup {
    key: string;
    name: string;
    children: MaterialBalanceSection[];
    itemCount: number;
}
export interface MaterialBalanceSection {
    key: string;
    name: string;
    children: MaterialBalanceSubgroup[];
    itemCount: number;
}

// Only the hierarchy changes: construction → site → rental, or rental →
// construction → site. Material quantities remain separate by site and unit.
export const groupMaterialBalances = (rows: MaterialSiteBalance[], mode: MaterialBalanceGrouping): MaterialBalanceGroup[] => {
    const groups = new Map<string, MaterialBalanceGroup>();
    const sections = new Map<string, MaterialBalanceSection>();
    const leaves = new Map<string, MaterialBalanceSubgroup>();
    rows.forEach(row => {
        const primaryId = mode === 'site' ? row.constructionKey : row.rentalKey;
        const secondaryId = mode === 'site' ? row.siteId : row.constructionKey;
        const tertiaryId = mode === 'site' ? row.rentalKey : row.siteId;
        const key = JSON.stringify([mode, primaryId]);
        let group = groups.get(key);
        if (!group) {
            group = { key, name: mode === 'site' ? row.constructionName : row.rentalName, children: [], itemCount: 0 };
            groups.set(key, group);
        }
        const sectionKey = JSON.stringify([key, secondaryId]);
        let section = sections.get(sectionKey);
        if (!section) {
            section = { key: sectionKey, name: mode === 'site' ? row.siteName : row.constructionName, children: [], itemCount: 0 };
            sections.set(sectionKey, section);
            group.children.push(section);
        }
        const leafKey = JSON.stringify([sectionKey, tertiaryId]);
        let leaf = leaves.get(leafKey);
        if (!leaf) {
            leaf = { key: leafKey, name: mode === 'site' ? row.rentalName : row.siteName, siteName: row.siteName, rentalName: row.rentalName, rows: [] };
            leaves.set(leafKey, leaf);
            section.children.push(leaf);
        }
        leaf.rows.push(row);
        group.itemCount += 1;
        section.itemCount += 1;
    });
    const byName = (a: { name: string; key: string }, b: { name: string; key: string }) =>
        a.name.localeCompare(b.name, 'ko', { numeric: true }) || a.key.localeCompare(b.key);
    return Array.from(groups.values()).sort(byName).map(group => ({
        ...group, children: group.children.sort(byName).map(section => ({
            ...section, children: section.children.sort(byName).map(child => ({
                ...child, rows: child.rows.sort((a, b) => a.category.localeCompare(b.category, 'ko')
                    || a.itemName.localeCompare(b.itemName, 'ko')
                    || a.spec.localeCompare(b.spec, 'ko', { numeric: true }) || a.unit.localeCompare(b.unit) || a.key.localeCompare(b.key)),
            })),
        })),
    }));
};

export const flattenMaterialBalanceGroups = (groups: MaterialBalanceGroup[]) =>
    groups.flatMap(group => group.children.flatMap(section => section.children.flatMap(child => child.rows)));

export const buildMaterialSiteBalances = (
    transactions: MaterialTransactionRow[],
    companies: MaterialRentalCompanyOption[],
    asOfDate: string,
    sites: Site[] = [],
): MaterialSiteBalance[] => {
    const rows = transactions.filter(row => row.transactionDate <= asOfDate);
    const siteById = new Map(sites.map(site => [site.id, site]));
    const constructionNamesById = new Map<string, string>();
    const constructionIdsByName = new Map<string, Set<string>>();
    sites.forEach(site => {
        const id = text(site.clientCompanyId);
        const name = text(site.clientCompanyName);
        if (!id || !name) return;
        constructionNamesById.set(id, name);
        const ids = constructionIdsByName.get(normalized(name)) || new Set<string>();
        ids.add(id);
        constructionIdsByName.set(normalized(name), ids);
    });
    const namesById = new Map(companies.map(company => [company.id, company.name]));
    const idsByName = new Map<string, Set<string>>();
    const register = (id: string, name: string) => {
        if (!id || !name) return;
        const key = normalized(name);
        const ids = idsByName.get(key) || new Set<string>();
        ids.add(id);
        idsByName.set(key, ids);
        if (!namesById.has(id)) namesById.set(id, name);
    };
    companies.forEach(company => register(text(company.id), text(company.name)));
    rows.forEach(row => register(text(row.rentalCompanyId), text(row.rentalCompanyName)));

    const groups = new Map<string, MaterialSiteBalance>();
    rows.forEach(row => {
        const name = text(row.rentalCompanyName);
        const matchingIds = idsByName.get(normalized(name));
        // Explicit IDs always win. Only resolve name-only history when unambiguous.
        const id = text(row.rentalCompanyId) || (matchingIds?.size === 1 ? Array.from(matchingIds)[0] : '');
        const rentalKey = id ? `id:${id}` : name ? `name:${normalized(name)}` : UNASSIGNED_BALANCE_RENTAL;
        // Service rows already have normalized material fields. Include the unit even
        // when a materialKey exists: EA and SET must never offset one another.
        const materialKey = row.materialKey || JSON.stringify([row.category, row.itemName, row.spec].map(normalized));
        const key = JSON.stringify([row.siteId, rentalKey, materialKey, normalized(row.unit)]);
        let group = groups.get(key);
        if (!group) {
            // Site management stores the construction client in clientCompany*.
            // company*/constructorCompany* identifies the subcontractor instead.
            const site = siteById.get(row.siteId);
            const constructionName = text(site?.clientCompanyName);
            const constructionIds = constructionIdsByName.get(normalized(constructionName));
            const constructionId = text(site?.clientCompanyId) || (constructionIds?.size === 1 ? Array.from(constructionIds)[0] : '');
            group = {
                key, siteId: row.siteId, siteName: row.siteName, rentalKey,
                constructionKey: constructionId ? `id:${constructionId}` : constructionName ? `name:${normalized(constructionName)}` : 'unassigned',
                constructionName: (constructionId && constructionNamesById.get(constructionId)) || constructionName || (constructionId ? '이름 없는 건설사' : '건설사 미지정'),
                rentalName: (id && namesById.get(id)) || name || (id ? '이름 없는 임대사' : '임대사 미지정'),
                rentalNeedsReview: !id,
                category: row.category, itemName: row.itemName, spec: row.spec, unit: row.unit,
                inbound: 0, outbound: 0, balance: 0, transactions: [],
            };
            groups.set(key, group);
        }
        group[row.type] += row.quantity;
        group.transactions.push(row);
    });
    return Array.from(groups.values()).map(group => ({
        ...group,
        inbound: quantity(group.inbound), outbound: quantity(group.outbound),
        balance: quantity(group.inbound - group.outbound),
        transactions: group.transactions.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)
            || (a.type === b.type ? a.id.localeCompare(b.id) : a.type === 'inbound' ? -1 : 1)),
    })).sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko')
        || a.siteId.localeCompare(b.siteId)
        || a.rentalName.localeCompare(b.rentalName, 'ko')
        || a.rentalKey.localeCompare(b.rentalKey)
        || a.category.localeCompare(b.category, 'ko')
        || a.itemName.localeCompare(b.itemName, 'ko')
        || a.spec.localeCompare(b.spec, 'ko', { numeric: true })
        || a.unit.localeCompare(b.unit));
};

export const buildMaterialBalanceHistory = (group: MaterialSiteBalance) => {
    let balance = 0;
    return group.transactions.map(transaction => {
        balance = quantity(balance + (transaction.type === 'inbound' ? transaction.quantity : -transaction.quantity));
        return { transaction, balance };
    });
};

export interface MaterialBalanceDateEntry {
    material: MaterialSiteBalance;
    transaction: MaterialTransactionRow;
    balance: number;
}
export interface MaterialBalanceDateGroup {
    date: string;
    entries: MaterialBalanceDateEntry[];
    inboundCount: number;
    outboundCount: number;
}

// Calculate each material's running balance before regrouping by date. A date
// header counts records, never sums quantities with different materials/units.
export const groupMaterialBalanceTransactionsByDate = (rows: MaterialSiteBalance[]): MaterialBalanceDateGroup[] => {
    const dates = new Map<string, MaterialBalanceDateGroup>();
    rows.forEach(material => buildMaterialBalanceHistory(material).forEach(entry => {
        const date = entry.transaction.transactionDate;
        let day = dates.get(date);
        if (!day) {
            day = { date, entries: [], inboundCount: 0, outboundCount: 0 };
            dates.set(date, day);
        }
        day.entries.push({ ...entry, material });
        if (entry.transaction.type === 'inbound') day.inboundCount += 1;
        else day.outboundCount += 1;
    }));
    return Array.from(dates.values()).sort((a, b) => b.date.localeCompare(a.date));
};

export const MATERIAL_DAILY_EXCEL_HEADERS = ['건설사', '현장', '임대사', '일자', '구분', '분류', '품명', '규격', '단위', '입고', '출고', '거래 후 잔량', '차량번호', '비고'];
export const buildMaterialDailyExcelRows = (groups: MaterialBalanceGroup[]) => groups.flatMap(group => group.children.flatMap(section => section.children.flatMap(child =>
    groupMaterialBalanceTransactionsByDate(child.rows).flatMap(day => day.entries.map(({ material, transaction, balance }) => [
        material.constructionName, material.siteName, material.rentalName, day.date, transaction.type === 'inbound' ? '입고' : '출고',
        material.category, material.itemName, material.spec, material.unit,
        transaction.type === 'inbound' ? transaction.quantity : '', transaction.type === 'outbound' ? transaction.quantity : '',
        balance, transaction.vehicleNumber || '', transaction.notes || '',
    ])))));

export const MATERIAL_BALANCE_EXCEL_HEADERS = ['기준일', '건설사', '현장', '임대사', '분류', '품명', '규격', '단위', '누적 입고', '누적 출고', '현장 잔량', '확인 사항'];
export const buildMaterialBalanceExcelRows = (rows: MaterialSiteBalance[], asOfDate: string) => rows.map(row => [
    asOfDate, row.constructionName, row.siteName, row.rentalName, row.category, row.itemName, row.spec, row.unit,
    row.inbound, row.outbound, row.balance,
    [row.balance < 0 ? '출고 초과' : '', row.rentalNeedsReview ? '임대사 확인 필요' : ''].filter(Boolean).join(' · '),
]);
