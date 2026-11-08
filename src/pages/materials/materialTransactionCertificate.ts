import type { Site } from '../../services/siteService';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';
import type { OutboundCertificateDraft } from './materialOutboundCertificateDraftStore';
import { getMaterialTransactionRentalCompanyLink } from './materialTransactionRentalCompany';

const text = (value: unknown) => String(value || '').trim();

export const getOutboundCertificateGroupKey = (row: MaterialTransactionRow): string => {
    const rental = getMaterialTransactionRentalCompanyLink(row);
    return JSON.stringify([row.transactionDate.slice(0, 10), row.siteId, rental.id || rental.name, text(row.vehicleNumber)]);
};

export const groupOutboundCertificates = (rows: MaterialTransactionRow[]): MaterialTransactionRow[][] => {
    const groups = new Map<string, MaterialTransactionRow[]>();
    rows.filter(row => row.type === 'outbound').forEach(row => {
        const key = getOutboundCertificateGroupKey(row);
        groups.set(key, [...(groups.get(key) || []), row]);
    });
    return [...groups.values()];
};

export const buildTransactionOutboundCertificate = (
    id: string, rows: MaterialTransactionRow[], sites: Site[], companies: MaterialRentalCompanyOption[],
): OutboundCertificateDraft => {
    const first = rows[0];
    if (!first || rows.some(row => row.type !== 'outbound' || getOutboundCertificateGroupKey(row) !== getOutboundCertificateGroupKey(first))) {
        throw new Error('같은 날짜·현장·임대사·차량의 출고 내역만 반출증으로 만들 수 있습니다.');
    }
    const rental = getMaterialTransactionRentalCompanyLink(first);
    const company = companies.find(item => item.id === rental.id)
        || (!rental.id ? companies.find(item => item.name.trim() === rental.name) : undefined);
    const items = new Map<string, OutboundCertificateDraft['items'][number]>();
    rows.forEach(row => {
        const key = JSON.stringify([row.materialKey || row.materialId, row.category, row.itemName, row.spec, row.unit]);
        const existing = items.get(key);
        if (existing) existing.quantity += Number(row.quantity || 0);
        else items.set(key, { id: row.materialId, materialKey: row.materialKey, category: row.category,
            itemName: row.itemName, spec: row.spec, unit: row.unit, isActive: true, quantity: Number(row.quantity || 0) });
    });
    return {
        id, transactionDate: first.transactionDate.slice(0, 10), siteId: first.siteId, siteName: first.siteName,
        siteAddress: sites.find(site => site.id === first.siteId)?.address || '',
        rentalCompanyId: rental.id, rentalCompanyName: rental.name, rentalCompanyAddress: company?.address || '',
        vehicleNumber: text(first.vehicleNumber), recipient: '', registeredByName: '',
        items: [...items.values()], photos: [], createdAt: Date.now(), returnTo: '/materials/transactions',
        photoReferences: rows.map(row => ({ photoBatchId: row.photoBatchId, photoCount: row.photoCount, photoUrls: row.photoUrls })),
    };
};
