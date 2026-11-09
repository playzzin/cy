import type { Site } from '../../services/siteService';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import type { InboundCertificateDraft } from './materialInboundCertificateDraftStore';
import type { OutboundCertificateDraft } from './materialOutboundCertificateDraftStore';
import { getMaterialTransactionRentalCompanyLink } from './materialTransactionRentalCompany';

const text = (value: unknown) => String(value || '').trim();
const normalizeName = (value: string) => value.replace(/\s+/g, '').toLowerCase();

const resolveRental = (row: MaterialTransactionRow, companies: MaterialRentalCompanyOption[]) => {
    const rental = getMaterialTransactionRentalCompanyLink(row);
    const matches = companies.filter(company => rental.id ? company.id === rental.id
        : !!rental.name && normalizeName(company.name) === normalizeName(rental.name));
    const company = matches.length === 1 ? matches[0] : undefined;
    return { id: rental.id || company?.id || '', name: company?.name || rental.name, address: company?.address || '' };
};

// Filters only affect which rows are visible. Certificates use all loaded rows
// belonging to the same direction, date, site, rental company and vehicle.
export const getTransactionCertificateGroupKey = (row: MaterialTransactionRow, companies: MaterialRentalCompanyOption[] = []): string => {
    const rental = resolveRental(row, companies);
    return JSON.stringify([row.type, row.transactionDate.trim().slice(0, 10),
        row.siteId ? ['id', row.siteId] : ['name', text(row.siteName)],
        rental.id ? ['id', rental.id] : ['name', normalizeName(rental.name)], text(row.vehicleNumber)]);
};

const buildCertificate = (
    id: string, rows: MaterialTransactionRow[], sites: Site[], companies: MaterialRentalCompanyOption[], type: MaterialTransactionRow['type'],
) => {
    const first = rows[0];
    if (!first || first.type !== type || rows.some(row => getTransactionCertificateGroupKey(row, companies) !== getTransactionCertificateGroupKey(first, companies))) {
        throw new Error('같은 구분·날짜·현장·임대사·차량의 입출고 내역만 증빙으로 만들 수 있습니다.');
    }
    const rental = resolveRental(first, companies);
    const site = sites.find(item => item.id === first.siteId);
    const items = new Map<string, OutboundCertificateDraft['items'][number]>();
    rows.forEach(row => {
        const key = JSON.stringify([row.materialKey || row.materialId, row.category, row.itemName, row.spec, row.unit]);
        const existing = items.get(key);
        if (existing) existing.quantity = Number((existing.quantity + Number(row.quantity || 0)).toFixed(9));
        else items.set(key, { id: row.materialId, materialKey: row.materialKey, category: row.category,
            itemName: row.itemName, spec: row.spec, unit: row.unit, isActive: true, quantity: Number(row.quantity || 0) });
    });
    return {
        id, transactionDate: first.transactionDate.trim().slice(0, 10), siteId: first.siteId, siteName: site?.name || first.siteName,
        siteAddress: site?.address || '',
        rentalCompanyId: rental.id, rentalCompanyName: rental.name, rentalCompanyAddress: rental.address,
        vehicleNumber: text(first.vehicleNumber), registeredByName: '',
        items: [...items.values()], photos: [], createdAt: Date.now(), returnTo: '/materials/transactions' as const,
        photoReferences: rows.map(row => ({ photoBatchId: row.photoBatchId, photoCount: row.photoCount, photoUrls: row.photoUrls })),
    };
};

export const buildTransactionOutboundCertificate = (
    id: string, rows: MaterialTransactionRow[], sites: Site[], companies: MaterialRentalCompanyOption[],
): OutboundCertificateDraft => ({ ...buildCertificate(id, rows, sites, companies, 'outbound'), recipient: '' });

export const buildTransactionInboundCertificate = (
    id: string, rows: MaterialTransactionRow[], sites: Site[], companies: MaterialRentalCompanyOption[],
): InboundCertificateDraft => ({ ...buildCertificate(id, rows, sites, companies, 'inbound'), supplier: '' });
