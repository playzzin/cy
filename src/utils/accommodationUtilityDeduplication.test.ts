import type { UtilityRecord } from '../types/accommodation';
import type {
    AccommodationElectricityBillApplyItem,
} from '../types/accommodationElectricityBillImport';
import { Timestamp } from '../types/timestamp';
import {
    buildAccommodationUtilityRecordId,
    dedupeAccommodationUtilityRecords,
    filterNewAccommodationUtilityBillItems,
    hasSameAccommodationUtilityBillingSnapshot,
} from './accommodationUtilityDeduplication';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const buildRecord = (overrides: Partial<UtilityRecord> = {}): UtilityRecord => ({
    id: 'legacy-random-id',
    accommodationId: 'room/204',
    accommodationName: '204호',
    yearMonth: '2026-06',
    costs: {
        rent: 0,
        electricity: 19370,
        gas: 0,
        water: 0,
        internet: 0,
        maintenance: 0,
        other: 0,
        total: 19370,
    },
    paymentStatus: 'unpaid',
    ...overrides,
});

const buildItem = (hash: string, sourceFileName = '전기요금.jpg'): AccommodationElectricityBillApplyItem => ({
    utilityType: 'electricity',
    fileIndex: 0,
    recordId: 'legacy-random-id',
    accommodationId: 'room/204',
    electricityAmount: 19370,
    meta: {
        sourceFileName,
        sourceFileSha256: hash,
        provider: '한국전력공사',
        customerNumber: '1234',
        billingYearMonth: '2026-06',
        dueDate: '',
        usagePeriodStart: '',
        usagePeriodEnd: '',
        address: '',
        housingName: '204호',
        usageKwh: 105,
        confidence: 0.98,
        analyzedAt: '2026-08-19T00:00:00.000Z',
    },
});

describe('accommodation utility duplicate protection', () => {
    it('uses one deterministic Firestore document id per accommodation and month', () => {
        expect(buildAccommodationUtilityRecordId('room/204', '2026-06'))
            .toBe('utility_2026-06_room%2F204');
    });

    it('rejects the same source bytes even when the file was renamed', () => {
        const record = buildRecord({
            electricityBillImport: buildItem(HASH_A, '원본.jpg').meta,
        });
        const result = filterNewAccommodationUtilityBillItems(
            [record],
            [buildItem(HASH_A, '이름변경.jpg')],
        );

        expect(result).toEqual({ accepted: [], duplicateCount: 1 });
    });

    it('accepts a genuinely different file even when its name is reused', () => {
        const record = buildRecord({
            electricityBillImport: buildItem(HASH_A, '전기요금.jpg').meta,
        });
        const result = filterNewAccommodationUtilityBillItems(
            [record],
            [buildItem(HASH_B, '전기요금.jpg')],
        );

        expect(result.accepted).toHaveLength(1);
        expect(result.duplicateCount).toBe(0);
    });

    it('does not use a filename fallback when only one side has a trusted hash', () => {
        const record = buildRecord({
            electricityBillImport: {
                ...buildItem('', '전기요금.jpg').meta,
                sourceFileSha256: undefined,
            },
        });
        const result = filterNewAccommodationUtilityBillItems(
            [record],
            [buildItem(HASH_B, '전기요금.jpg')],
        );

        expect(result.accepted).toHaveLength(1);
        expect(result.duplicateCount).toBe(0);
    });

    it('uses filename fallback only for matching accommodation/provider scope without hashes', () => {
        const record = buildRecord({
            electricityBillImport: {
                ...buildItem('', '전기요금.jpg').meta,
                sourceFileSha256: undefined,
            },
        });
        const sameScope = buildItem('', '전기요금.jpg');
        const otherAccommodation = {
            ...buildItem('', '전기요금.jpg'),
            accommodationId: 'room/205',
        };
        const otherProvider = {
            ...buildItem('', '전기요금.jpg'),
            meta: {
                ...buildItem('', '전기요금.jpg').meta,
                provider: '다른 공급자',
            },
        };

        expect(filterNewAccommodationUtilityBillItems([record], [sameScope]).duplicateCount).toBe(1);
        expect(filterNewAccommodationUtilityBillItems([record], [otherAccommodation]).accepted).toHaveLength(1);
        expect(filterNewAccommodationUtilityBillItems([record], [otherProvider]).accepted).toHaveLength(1);
    });

    it('collapses duplicate logical ledger rows without hiding a newer legacy row', () => {
        const canonicalId = buildAccommodationUtilityRecordId('room/204', '2026-06');
        const newerLegacy = buildRecord({
            id: 'legacy-newer-id',
            costs: { ...buildRecord().costs, electricity: 99999 },
            updatedAt: Timestamp.fromMillis(2000),
        });
        const canonical = buildRecord({
            id: canonicalId,
            updatedAt: Timestamp.fromMillis(1000),
        });

        expect(dedupeAccommodationUtilityRecords([newerLegacy, canonical])).toEqual([newerLegacy]);
    });

    it('prefers the canonical id when duplicate rows have the same timestamp', () => {
        const canonicalId = buildAccommodationUtilityRecordId('room/204', '2026-06');
        const legacy = buildRecord({ id: 'legacy-id', updatedAt: Timestamp.fromMillis(1000) });
        const canonical = buildRecord({ id: canonicalId, updatedAt: Timestamp.fromMillis(1000) });

        expect(dedupeAccommodationUtilityRecords([legacy, canonical])).toEqual([canonical]);
    });

    it('uses the newest legacy row when no canonical row exists', () => {
        const older = buildRecord({ id: 'old', updatedAt: Timestamp.fromMillis(1000) });
        const newer = buildRecord({ id: 'new', updatedAt: Timestamp.fromMillis(2000) });

        expect(dedupeAccommodationUtilityRecords([older, newer])).toEqual([newer]);
    });

    it('detects unsaved screen amounts before billing', () => {
        const saved = buildRecord();
        const unchanged = buildRecord({ id: 'different-client-id' });
        const unsaved = buildRecord({
            costs: {
                ...saved.costs,
                electricity: saved.costs.electricity + 1000,
                total: saved.costs.total + 1000,
            },
        });

        expect(hasSameAccommodationUtilityBillingSnapshot(unchanged, saved)).toBe(true);
        expect(hasSameAccommodationUtilityBillingSnapshot(unsaved, saved)).toBe(false);
    });
});
