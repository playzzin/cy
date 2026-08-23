import type { UtilityRecord } from '../types/accommodation';
import type {
    AccommodationUtilityBillApplyItem,
    AccommodationUtilityBillType,
} from '../types/accommodationElectricityBillImport';

interface UtilityBillSourceMeta {
    sourceFileName: string;
    sourceFileSha256?: string;
    billingYearMonth: string;
    provider?: string;
}

interface UtilityBillSourceIdentity {
    sha256: string;
    fallback: string;
}

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeSha256 = (value: unknown): string => {
    const normalized = normalizeText(value).toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : '';
};

const normalizeFileName = (value: unknown): string => normalizeText(value)
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR');

const getMetaSourceIdentity = (
    utilityType: AccommodationUtilityBillType,
    meta: UtilityBillSourceMeta,
    accommodationId: unknown,
): UtilityBillSourceIdentity => ({
    sha256: normalizeSha256(meta.sourceFileSha256),
    fallback: [
        normalizeText(accommodationId),
        utilityType,
        normalizeText(meta.billingYearMonth),
        normalizeText(meta.provider).toLocaleLowerCase('ko-KR'),
        normalizeFileName(meta.sourceFileName),
    ].join('|'),
});

const getItemSourceIdentity = (item: AccommodationUtilityBillApplyItem): UtilityBillSourceIdentity => (
    getMetaSourceIdentity(item.utilityType, item.meta, item.accommodationId)
);

const getRecordSourceIdentities = (record: UtilityRecord): UtilityBillSourceIdentity[] => {
    const identities: UtilityBillSourceIdentity[] = [];
    if (record.electricityBillImport) {
        identities.push(getMetaSourceIdentity('electricity', record.electricityBillImport, record.accommodationId));
    }
    if (record.gasBillImport) {
        identities.push(getMetaSourceIdentity('gas', record.gasBillImport, record.accommodationId));
    }
    if (record.waterBillImport) {
        identities.push(getMetaSourceIdentity('water', record.waterBillImport, record.accommodationId));
    }
    return identities;
};

const sourcesMatch = (
    left: UtilityBillSourceIdentity,
    right: UtilityBillSourceIdentity,
): boolean => {
    if (left.sha256 && right.sha256) return left.sha256 === right.sha256;
    if (left.sha256 || right.sha256) return false;
    return Boolean(left.fallback && right.fallback && left.fallback === right.fallback);
};

export const filterNewAccommodationUtilityBillItems = (
    records: UtilityRecord[],
    items: AccommodationUtilityBillApplyItem[],
): { accepted: AccommodationUtilityBillApplyItem[]; duplicateCount: number } => {
    const knownSources = records.flatMap(getRecordSourceIdentities);
    const accepted: AccommodationUtilityBillApplyItem[] = [];
    let duplicateCount = 0;

    items.forEach((item) => {
        const source = getItemSourceIdentity(item);
        if (knownSources.some((known) => sourcesMatch(known, source))) {
            duplicateCount += 1;
            return;
        }
        knownSources.push(source);
        accepted.push(item);
    });

    return { accepted, duplicateCount };
};

export const hasAccommodationUtilityBillSource = (
    records: UtilityRecord[],
    utilityType: AccommodationUtilityBillType,
    accommodationId: string,
    meta: UtilityBillSourceMeta,
): boolean => {
    const source = getMetaSourceIdentity(utilityType, meta, accommodationId);
    return records
        .flatMap(getRecordSourceIdentities)
        .some((known) => sourcesMatch(known, source));
};

export const buildAccommodationUtilityRecordId = (
    accommodationId: unknown,
    yearMonth: unknown,
): string => {
    const normalizedAccommodationId = normalizeText(accommodationId);
    const normalizedYearMonth = normalizeText(yearMonth);
    return `utility_${normalizedYearMonth}_${encodeURIComponent(normalizedAccommodationId)}`;
};

export const getAccommodationUtilityRecordKey = (record: Partial<UtilityRecord>): string => {
    const accommodationId = normalizeText(record.accommodationId);
    const yearMonth = normalizeText(record.yearMonth);
    return accommodationId && yearMonth ? `${accommodationId}|${yearMonth}` : '';
};

const getTimestampMillis = (value: unknown): number => {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        return Number((value as { toMillis: () => number }).toMillis()) || 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') return Date.parse(value) || 0;
    return 0;
};

const choosePreferredRecord = (left: UtilityRecord, right: UtilityRecord): UtilityRecord => {
    const leftTimestamp = Math.max(getTimestampMillis(left.updatedAt), getTimestampMillis(left.createdAt));
    const rightTimestamp = Math.max(getTimestampMillis(right.updatedAt), getTimestampMillis(right.createdAt));
    if (leftTimestamp !== rightTimestamp) return rightTimestamp > leftTimestamp ? right : left;

    const canonicalId = buildAccommodationUtilityRecordId(left.accommodationId, left.yearMonth);
    if (left.id === canonicalId && right.id !== canonicalId) return left;
    if (right.id === canonicalId && left.id !== canonicalId) return right;
    return normalizeText(right.id).localeCompare(normalizeText(left.id)) > 0 ? right : left;
};

export const dedupeAccommodationUtilityRecords = (records: UtilityRecord[]): UtilityRecord[] => {
    const unique = new Map<string, UtilityRecord>();

    records.forEach((record) => {
        const logicalKey = getAccommodationUtilityRecordKey(record) || `id:${normalizeText(record.id)}`;
        const previous = unique.get(logicalKey);
        unique.set(logicalKey, previous ? choosePreferredRecord(previous, record) : record);
    });

    return Array.from(unique.values());
};

export const dedupeAccommodationUtilityRecordWrites = <T extends Partial<UtilityRecord>>(
    records: T[],
): T[] => {
    const unique = new Map<string, T>();
    records.forEach((record, index) => {
        const logicalKey = getAccommodationUtilityRecordKey(record) || `row:${index}`;
        unique.set(logicalKey, record);
    });
    return Array.from(unique.values());
};

const BILLABLE_COST_FIELDS: Array<keyof UtilityRecord['costs']> = [
    'rent',
    'electricity',
    'gas',
    'water',
    'internet',
    'maintenance',
    'other',
    'total',
];

export const hasSameAccommodationUtilityBillingSnapshot = (
    screenRecord: UtilityRecord,
    savedRecord: UtilityRecord,
): boolean => (
    normalizeText(screenRecord.accommodationId) === normalizeText(savedRecord.accommodationId)
    && normalizeText(screenRecord.yearMonth) === normalizeText(savedRecord.yearMonth)
    && BILLABLE_COST_FIELDS.every((field) => (
        Number(screenRecord.costs?.[field] ?? 0) === Number(savedRecord.costs?.[field] ?? 0)
    ))
);
