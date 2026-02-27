import app, { db } from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import {
    connectorConfig,
    listAllAccommodations,
    createAccommodation,
    updateAccommodation,
    deleteAccommodation,
    listAllUtilityRecords,
    createUtilityRecord,
    updateUtilityRecord,
    listAllAccommodationAssignments
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';
import { Accommodation, UtilityRecord, UtilityCosts, Contract, CostProfile } from '../types/accommodation';
import { AccommodationAssignment } from '../types/accommodationAssignment';
import { accommodationAssignmentService } from './accommodationAssignmentService';

const dc = getDataConnect(app, connectorConfig);
const ACCOMMODATION_COLLECTION_CANDIDATES = ['accommodations'];

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

let accommodationsLoaded = false;
const accommodationLegacyIdToUuid = new Map<string, string>();

const toFirestoreTimestamp = (value?: unknown): Timestamp | null => {
    if (!value) return null;
    if (value instanceof Timestamp) return value;
    if (typeof (value as any)?.toDate === 'function') {
        try {
            return Timestamp.fromDate((value as any).toDate());
        } catch {
            // ignore
        }
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Timestamp.fromMillis(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    try {
        return Timestamp.fromDate(new Date(String(value)));
    } catch {
        return null;
    }
};

const safeJsonParse = <T,>(value: unknown, fallback: T): T => {
    if (value && typeof value === 'object') {
        return value as T;
    }
    if (typeof value !== 'string' || !value) return fallback;
    try {
        const parsed = JSON.parse(value);
        return (parsed ?? fallback) as T;
    } catch {
        return fallback;
    }
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned) return fallback;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const toOptionalFiniteNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    const parsed = toFiniteNumber(value, Number.NaN);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const hasExplicitNumericInContract = (value: unknown, keys: string[]): boolean => {
    const parsed = toPlainObject(value);
    const resolved = readFirstDefinedValue(parsed, keys);
    return toOptionalFiniteNumber(resolved) !== undefined;
};

const pickFirstPositiveNumber = (...values: Array<number | undefined>): number | undefined => {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return undefined;
};

const hasMeaningfulValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
};

const normalizeLookupKey = (value: unknown): string => {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[-_.()[\]{},/\\]/g, '');
};

const toPlainObject = (value: unknown): Record<string, unknown> => {
    if (!value) return {};
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
            return {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
};

const mergeObjectLikeSources = (primary: unknown, fallback: unknown): unknown => {
    const primaryObj = toPlainObject(primary);
    const fallbackObj = toPlainObject(fallback);

    const hasPrimary = Object.keys(primaryObj).length > 0;
    const hasFallback = Object.keys(fallbackObj).length > 0;

    if (hasPrimary && hasFallback) return { ...fallbackObj, ...primaryObj };
    if (hasPrimary) return primary;
    if (hasFallback) return fallback;
    return primary ?? fallback;
};

const readFirstDefinedValue = (source: Record<string, unknown>, keys: string[]): unknown => {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim().length === 0) continue;
        return value;
    }
    return undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return undefined;
        if (['true', '1', 'y', 'yes', 't', 'on', 'checked', '예', '네'].includes(normalized)) return true;
        if (['false', '0', 'n', 'no', 'f', 'off', 'unchecked', '아니오', '아니요'].includes(normalized)) return false;
    }
    return undefined;
};

const normalizeContract = (value: unknown): Contract => {
    const parsed = toPlainObject(value);
    const parsedAny = parsed as Record<string, unknown>;
    const landlordObj = toPlainObject(readFirstDefinedValue(parsedAny, ['landlord', 'landlordInfo', 'owner', 'ownerInfo', '임대인정보']));
    const bankAccountObj = toPlainObject(readFirstDefinedValue(parsedAny, ['bankAccount', 'paymentAccount', 'accountInfo', 'paymentInfo', '계좌정보']));

    const normalizeDay = (rawValue: unknown, fallback = 1): number => {
        return Math.max(1, Math.min(31, Math.floor(toFiniteNumber(rawValue, fallback))));
    };

    const depositValue =
        toOptionalFiniteNumber(readFirstDefinedValue(parsedAny, ['deposit', 'securityDeposit', 'guaranteeDeposit', '보증금'])) ??
        0;
    const monthlyRentValue =
        toOptionalFiniteNumber(readFirstDefinedValue(parsedAny, ['monthlyRent', 'rent', 'monthRent', 'monthlyFee', '월세'])) ??
        0;
    const paymentDayValue =
        toOptionalFiniteNumber(readFirstDefinedValue(parsedAny, ['paymentDay', 'rentPayDate', 'payDay', 'paymentDate', '납부일', '월세일'])) ??
        1;
    const paymentDay = normalizeDay(paymentDayValue, 1);
    const rentPayDateRaw = toOptionalFiniteNumber(readFirstDefinedValue(parsedAny, ['rentPayDate', 'paymentDay', 'payDay', '납부일', '월세일']));
    const rentPayDate = normalizeDay(rentPayDateRaw ?? paymentDay, paymentDay);

    const landlordName =
        toOptionalString(readFirstDefinedValue(parsedAny, ['landlordName', 'ownerName', 'lessorName', '임대인', '임대인명'])) ??
        toOptionalString(readFirstDefinedValue(landlordObj, ['name', 'ownerName', 'landlordName'])) ??
        '';

    const landlordContact =
        toOptionalString(readFirstDefinedValue(parsedAny, ['landlordContact', 'ownerContact', 'landlordPhone', '임대인연락처'])) ??
        toOptionalString(readFirstDefinedValue(landlordObj, ['contact', 'phone', 'landlordContact', 'ownerContact'])) ??
        '';

    const bankName =
        toOptionalString(readFirstDefinedValue(parsedAny, ['bankName', 'bank', '은행명'])) ??
        toOptionalString(readFirstDefinedValue(bankAccountObj, ['bankName', 'bank', 'name', '은행명']));

    const accountNumber =
        toOptionalString(readFirstDefinedValue(parsedAny, ['accountNumber', 'accountNo', 'bankAccount', '계좌번호'])) ??
        toOptionalString(readFirstDefinedValue(bankAccountObj, ['accountNumber', 'accountNo', 'number', '계좌번호']));

    const accountHolder =
        toOptionalString(readFirstDefinedValue(parsedAny, ['accountHolder', 'holder', '예금주'])) ??
        toOptionalString(readFirstDefinedValue(bankAccountObj, ['accountHolder', 'holder', 'name', '예금주']));

    const isReported = toOptionalBoolean(readFirstDefinedValue(parsedAny, ['isReported', 'reported', 'isContractReported', '신고여부'])) ?? false;
    const isAutoTransfer = toOptionalBoolean(readFirstDefinedValue(parsedAny, ['isAutoTransfer', 'autoTransfer', '자동이체']));
    const transferDayRaw = toOptionalFiniteNumber(readFirstDefinedValue(parsedAny, ['transferDay', 'autoTransferDay', '이체일']));
    const transferAccountInfo =
        toOptionalString(readFirstDefinedValue(parsedAny, ['transferAccountInfo', 'transferAccount', 'withdrawAccount', '출금계좌'])) ??
        toOptionalString(readFirstDefinedValue(bankAccountObj, ['transferAccountInfo', 'transferAccount', 'withdrawAccount']));

    return {
        startDate: toOptionalString(readFirstDefinedValue(parsedAny, ['startDate', 'contractStartDate', 'leaseStartDate', '시작일'])) ?? '',
        endDate: toOptionalString(readFirstDefinedValue(parsedAny, ['endDate', 'contractEndDate', 'leaseEndDate', '종료일'])) ?? '',
        deposit: toFiniteNumber(depositValue),
        monthlyRent: toFiniteNumber(monthlyRentValue),
        paymentDay,
        landlordName,
        landlordContact,
        isReported,
        bankName,
        accountNumber,
        accountHolder,
        rentPayDate,
        isAutoTransfer,
        transferDay: transferDayRaw !== undefined ? normalizeDay(transferDayRaw, paymentDay) : undefined,
        transferAccountInfo
    };
};

const normalizeCostProfile = (value: unknown): CostProfile => {
    const parsed = toPlainObject(value);
    const fixedObj = toPlainObject(readFirstDefinedValue(parsed, ['fixedCosts', 'fixedCost', 'fixed', '고정비']));

    const resolveModeValue = (keys: string[]): unknown => {
        return readFirstDefinedValue(parsed, keys);
    };

    const resolveFixedValue = (keys: string[]): number | undefined => {
        return (
            toOptionalFiniteNumber(readFirstDefinedValue(parsed, keys)) ??
            toOptionalFiniteNumber(readFirstDefinedValue(fixedObj, keys))
        );
    };

    const toMode = (mode: unknown): CostProfile['electricity'] => {
        if (mode === 'variable' || mode === 'fixed' || mode === 'included') return mode;
        if (typeof mode === 'string') {
            const normalized = mode.trim().toLowerCase();
            if (!normalized) return 'variable';
            if (normalized.includes('포함') || normalized.includes('include')) return 'included';
            if (normalized.includes('고정') || normalized.includes('fixed')) return 'fixed';
            if (normalized.includes('변동') || normalized.includes('variable') || normalized.includes('manual')) return 'variable';
        }
        return 'variable';
    };

    return {
        electricity: toMode(resolveModeValue(['electricity', 'electricityMode', 'electricityType', '전기', '전기세'])),
        gas: toMode(resolveModeValue(['gas', 'gasMode', 'gasType', '가스', '가스비'])),
        water: toMode(resolveModeValue(['water', 'waterMode', 'waterType', '수도', '수도세'])),
        internet: toMode(resolveModeValue(['internet', 'internetMode', 'internetType', '인터넷'])),
        maintenance: toMode(resolveModeValue(['maintenance', 'maintenanceMode', 'maintenanceType', '관리비'])),
        fixedElectricity: resolveFixedValue(['fixedElectricity', 'electricityFixed', 'electricityAmount', '전기고정', '전기세고정']),
        fixedGas: resolveFixedValue(['fixedGas', 'gasFixed', 'gasAmount', '가스고정', '가스비고정']),
        fixedWater: resolveFixedValue(['fixedWater', 'waterFixed', 'waterAmount', '수도고정', '수도세고정']),
        fixedInternet: resolveFixedValue(['fixedInternet', 'internetFixed', 'internetAmount', '인터넷고정']),
        fixedMaintenance: resolveFixedValue(['fixedMaintenance', 'maintenanceFixed', 'maintenanceAmount', '관리비고정'])
    };
};

const normalizeOwnership = (value?: string | null): Accommodation['ownership'] => {
    if (value === 'Cheongyeon' || value === 'Dawon' || value === 'Individual') return value;
    return 'Cheongyeon';
};

const normalizeAccommodationType = (value?: string | null): Accommodation['type'] => {
    if (value === 'OneRoom' || value === 'TwoRoom' || value === 'Apartment') return value;
    return 'OneRoom';
};

const normalizeAccommodationStatus = (value?: string | null): Accommodation['status'] => {
    if (value === 'active' || value === 'inactive') return value;
    return 'active';
};

const normalizePaymentStatus = (value?: string | null): UtilityRecord['paymentStatus'] => {
    if (value === 'paid' || value === 'pending' || value === 'unpaid') return value;
    return 'unpaid';
};

const normalizeUtilityCosts = (value: UtilityCosts): UtilityCosts => {
    const rent = toFiniteNumber(value?.rent);
    const electricity = toFiniteNumber(value?.electricity);
    const gas = toFiniteNumber(value?.gas);
    const water = toFiniteNumber(value?.water);
    const internet = toFiniteNumber(value?.internet);
    const maintenance = toFiniteNumber(value?.maintenance);
    const other = toFiniteNumber(value?.other);
    const total = rent + electricity + gas + water + internet + maintenance + other;
    return { rent, electricity, gas, water, internet, maintenance, other, total };
};

const loadFirestoreAccommodations = async (): Promise<any[]> => {
    for (const collectionName of ACCOMMODATION_COLLECTION_CANDIDATES) {
        try {
            const snapshot = await getDocs(collection(db, collectionName));
            if (snapshot.empty) continue;
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch {
            // ignore and try next candidate collection
        }
    }
    return [];
};

const loadDcAccommodations = async (): Promise<void> => {
    if (accommodationsLoaded) return;
    const res = await listAllAccommodations(dc);
    const rows = (res as any)?.data?.accommodations ?? [];
    accommodationLegacyIdToUuid.clear();
    rows.forEach((row: any) => {
        const id = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (id) accommodationLegacyIdToUuid.set(id, id);
        if (legacyId) accommodationLegacyIdToUuid.set(legacyId, id);
    });
    accommodationsLoaded = true;
};

const resolveAccommodationUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcAccommodations();
    const found = accommodationLegacyIdToUuid.get(raw);
    if (found) return found;

    accommodationsLoaded = false;
    await loadDcAccommodations();
    return accommodationLegacyIdToUuid.get(raw) ?? null;
};

const getCurrentYearMonth = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const DEFAULT_UTILITY_COSTS: UtilityCosts = {
    rent: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    internet: 0,
    maintenance: 0,
    other: 0,
    total: 0
};

const buildAccommodationFirestorePayload = (
    data: Partial<Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>> & { legacyId?: string | null },
    includeCreatedAt = false
): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp()
    };

    if (includeCreatedAt) {
        payload.createdAt = serverTimestamp();
    }

    if (data.legacyId !== undefined) payload.legacyId = data.legacyId ?? null;
    if (data.name !== undefined) payload.name = data.name ?? null;
    if (data.address !== undefined) payload.address = data.address ?? null;
    if (data.type !== undefined) payload.type = data.type ?? null;
    if (data.status !== undefined) payload.status = data.status ?? null;
    if (data.ownership !== undefined) payload.ownership = data.ownership ?? null;
    if (data.contract !== undefined) {
        payload.contract = data.contract ?? null;
        const normalizedContract = normalizeContract(data.contract);
        payload.monthlyRent = normalizedContract.monthlyRent;
        payload.deposit = normalizedContract.deposit;
    }
    if (data.costProfile !== undefined) payload.costProfile = data.costProfile ?? null;
    if (data.currentOccupantName !== undefined) payload.currentOccupantName = data.currentOccupantName ?? null;
    if (data.currentOccupantPhone !== undefined) payload.currentOccupantPhone = data.currentOccupantPhone ?? null;
    if (data.memo !== undefined) payload.memo = data.memo ?? null;

    return payload;
};

const syncAccommodationFirestoreMirror = async (
    accommodationId: string,
    payload: Record<string, unknown>
): Promise<void> => {
    if (!accommodationId) return;
    try {
        await setDoc(doc(db, 'accommodations', accommodationId), payload, { merge: true });
    } catch (error) {
        console.warn('Failed to sync accommodation mirror to Firestore', accommodationId, error);
    }
};

const syncCurrentMonthUtilityRent = async (
    accommodationUuid: string,
    monthlyRent: number,
    accommodationName?: string
): Promise<void> => {
    if (!accommodationUuid) return;

    const targetYearMonth = getCurrentYearMonth();
    const normalizedRent = toFiniteNumber(monthlyRent);

    try {
        const res = await listAllUtilityRecords(dc);
        const rows = (res as any)?.data?.utilityRecords ?? [];
        const targetRow = rows.find((row: any) => {
            const rowAccommodationUuid = String(row?.accommodation?.id ?? '');
            const rowYearMonth = String(row?.yearMonth ?? '');
            return rowAccommodationUuid === accommodationUuid && rowYearMonth === targetYearMonth;
        });

        if (!targetRow) {
            await createUtilityRecord(dc, {
                accommodationId: accommodationUuid,
                yearMonth: targetYearMonth,
                accommodationName: accommodationName ?? null,
                costs: JSON.stringify(normalizeUtilityCosts({
                    ...DEFAULT_UTILITY_COSTS,
                    rent: normalizedRent
                })),
                paymentDate: null,
                paymentStatus: 'unpaid',
                memo: null,
                isAnomaly: null
            } as any);
            return;
        }

        const existingCostsRaw = safeJsonParse<UtilityCosts>(targetRow?.costs, DEFAULT_UTILITY_COSTS);
        const nextCosts = normalizeUtilityCosts({
            ...DEFAULT_UTILITY_COSTS,
            ...existingCostsRaw,
            rent: normalizedRent
        });

        await updateUtilityRecord(dc, {
            accommodationId: accommodationUuid,
            yearMonth: targetYearMonth,
            accommodationName: accommodationName ?? targetRow?.accommodationName ?? null,
            costs: JSON.stringify(nextCosts),
            paymentDate: targetRow?.paymentDate ?? null,
            paymentStatus: targetRow?.paymentStatus ?? null,
            memo: targetRow?.memo ?? null,
            isAnomaly: typeof targetRow?.isAnomaly === 'boolean' ? targetRow.isAnomaly : null
        } as any);
    } catch (error) {
        console.warn('Failed to sync current-month utility rent', accommodationUuid, error);
    }
};

const syncCurrentMonthUtilityRentByName = async (
    accommodationName: string | undefined,
    monthlyRent: number
): Promise<void> => {
    const normalizedName = normalizeLookupKey(accommodationName);
    if (!normalizedName) return;

    const targetYearMonth = getCurrentYearMonth();
    const normalizedRent = toFiniteNumber(monthlyRent);

    try {
        const res = await listAllUtilityRecords(dc);
        const rows = (res as any)?.data?.utilityRecords ?? [];
        const targetRow = rows.find((row: any) => {
            const rowYearMonth = String(row?.yearMonth ?? '');
            if (rowYearMonth !== targetYearMonth) return false;
            return normalizeLookupKey(row?.accommodationName) === normalizedName;
        });

        if (!targetRow) return;

        const targetUuid = String(targetRow?.accommodation?.id ?? '');
        if (!targetUuid) return;

        const existingCostsRaw = safeJsonParse<UtilityCosts>(targetRow?.costs, DEFAULT_UTILITY_COSTS);
        const nextCosts = normalizeUtilityCosts({
            ...DEFAULT_UTILITY_COSTS,
            ...existingCostsRaw,
            rent: normalizedRent
        });

        await updateUtilityRecord(dc, {
            accommodationId: targetUuid,
            yearMonth: targetYearMonth,
            accommodationName: accommodationName ?? targetRow?.accommodationName ?? null,
            costs: JSON.stringify(nextCosts),
            paymentDate: targetRow?.paymentDate ?? null,
            paymentStatus: targetRow?.paymentStatus ?? null,
            memo: targetRow?.memo ?? null,
            isAnomaly: typeof targetRow?.isAnomaly === 'boolean' ? targetRow.isAnomaly : null
        } as any);
    } catch (error) {
        console.warn('Failed to sync current-month utility rent by accommodationName', accommodationName, error);
    }
};



export const accommodationService = {
    async getAssignments(): Promise<AccommodationAssignment[]> {
        try {
            return await accommodationAssignmentService.getAllAssignments();
        } catch (error) {
            console.error('Error fetching accommodation assignments:', error);
            return [];
        }
    },

    // --- Accommodation CRUD ---

    async getAccommodations(): Promise<Accommodation[]> {
        const res = await listAllAccommodations(dc);
        const rows = (res as any)?.data?.accommodations ?? [];
        accommodationsLoaded = false;
        await loadDcAccommodations();

        const firestoreRows = await loadFirestoreAccommodations();

        const firestoreById = new Map<string, any>();
        const firestoreByLegacyId = new Map<string, any>();
        const firestoreByName = new Map<string, any>();
        const firestoreByNameNormalized = new Map<string, any>();
        const firestoreByAddressNormalized = new Map<string, any>();
        firestoreRows.forEach((row: any) => {
            const id = row?.id ? String(row.id) : '';
            const legacyId = row?.legacyId ? String(row.legacyId) : '';
            const name = row?.name ? String(row.name).trim() : '';
            const nameNormalized = normalizeLookupKey(name);
            const addressNormalized = normalizeLookupKey(row?.address);
            if (id) firestoreById.set(id, row);
            if (legacyId) firestoreByLegacyId.set(legacyId, row);
            if (name && !firestoreByName.has(name)) firestoreByName.set(name, row);
            if (nameNormalized && !firestoreByNameNormalized.has(nameNormalized)) firestoreByNameNormalized.set(nameNormalized, row);
            if (addressNormalized && !firestoreByAddressNormalized.has(addressNormalized)) firestoreByAddressNormalized.set(addressNormalized, row);
        });

        const sourceRows: any[] = [];
        const seenIds = new Set<string>();
        const seenLegacyIds = new Set<string>();
        const seenNames = new Set<string>();

        const registerRow = (row: any) => {
            const id = row?.id ? String(row.id).trim() : '';
            const legacyId = row?.legacyId ? String(row.legacyId).trim() : '';
            const name = row?.name ? String(row.name).trim() : '';

            const isDuplicate =
                (id && seenIds.has(id)) ||
                (legacyId && seenLegacyIds.has(legacyId)) ||
                (name && seenNames.has(name));
            if (isDuplicate) return;

            sourceRows.push(row);
            if (id) seenIds.add(id);
            if (legacyId) seenLegacyIds.add(legacyId);
            if (name) seenNames.add(name);
        };

        rows.forEach(registerRow);
        firestoreRows.forEach(registerRow);

        return sourceRows
            .map((row: any) => {
                const rowId = row?.id ? String(row.id) : '';
                const rowLegacyId = row?.legacyId ? String(row.legacyId) : '';
                const rowName = row?.name ? String(row.name) : '';
                const rowNameNormalized = normalizeLookupKey(rowName);
                const rowAddressNormalized = normalizeLookupKey(row?.address);

                const hydrated = (rowId ? firestoreById.get(rowId) : undefined)
                    ?? (rowLegacyId ? firestoreByLegacyId.get(rowLegacyId) : undefined)
                    ?? (rowName.trim() ? firestoreByName.get(rowName.trim()) : undefined)
                    ?? (rowNameNormalized ? firestoreByNameNormalized.get(rowNameNormalized) : undefined)
                    ?? (rowAddressNormalized ? firestoreByAddressNormalized.get(rowAddressNormalized) : undefined)
                    ?? null;

                const merged = hydrated ? { ...hydrated, ...row } : row;
                const pickValue = <T,>(primary: T, fallback: T): T =>
                    hasMeaningfulValue(primary) ? primary : fallback;
                const id = rowId || (hydrated?.id ? String(hydrated.id) : (rowLegacyId || ''));

                const contractSource = mergeObjectLikeSources(row?.contract, hydrated?.contract);
                const costProfileSource = mergeObjectLikeSources(row?.costProfile, hydrated?.costProfile);
                const addressSource = pickValue(row?.address, hydrated?.address);
                const typeSource = pickValue(row?.type, hydrated?.type);
                const statusSource = pickValue(row?.status, hydrated?.status);
                const ownershipSource = pickValue(row?.ownership, hydrated?.ownership);
                const occupantNameSource = pickValue(row?.currentOccupantName, hydrated?.currentOccupantName);
                const occupantPhoneSource = pickValue(row?.currentOccupantPhone, hydrated?.currentOccupantPhone);
                const memoSource = pickValue(row?.memo, hydrated?.memo);
                const createdAtSource = pickValue(row?.createdAt, hydrated?.createdAt);
                const updatedAtSource = pickValue(row?.updatedAt, hydrated?.updatedAt);

                const normalizedPrimaryContract = normalizeContract(row?.contract);
                const normalizedFallbackContract = normalizeContract(hydrated?.contract);
                const mergedContract: Contract = normalizeContract(contractSource);
                const hasExplicitMonthlyRentInContract = hasExplicitNumericInContract(
                    contractSource,
                    ['monthlyRent', 'rent', 'monthRent', 'monthlyFee', '월세']
                );
                const hasExplicitDepositInContract = hasExplicitNumericInContract(
                    contractSource,
                    ['deposit', 'securityDeposit', 'guaranteeDeposit', '보증금']
                );

                const fallbackMonthlyRent = pickFirstPositiveNumber(
                    mergedContract.monthlyRent,
                    normalizedPrimaryContract.monthlyRent,
                    normalizedFallbackContract.monthlyRent,
                    toOptionalFiniteNumber((row as any)?.monthlyRent),
                    toOptionalFiniteNumber((hydrated as any)?.monthlyRent)
                );
                if (!hasExplicitMonthlyRentInContract && mergedContract.monthlyRent <= 0 && fallbackMonthlyRent !== undefined) {
                    mergedContract.monthlyRent = fallbackMonthlyRent;
                }

                const fallbackDeposit = pickFirstPositiveNumber(
                    mergedContract.deposit,
                    normalizedPrimaryContract.deposit,
                    normalizedFallbackContract.deposit,
                    toOptionalFiniteNumber((row as any)?.deposit),
                    toOptionalFiniteNumber((hydrated as any)?.deposit)
                );
                if (!hasExplicitDepositInContract && mergedContract.deposit <= 0 && fallbackDeposit !== undefined) {
                    mergedContract.deposit = fallbackDeposit;
                }

                const pickString = (...values: unknown[]): string | undefined => {
                    for (const value of values) {
                        const resolved = toOptionalString(value);
                        if (resolved) return resolved;
                    }
                    return undefined;
                };

                mergedContract.landlordName =
                    pickString(
                        mergedContract.landlordName,
                        normalizedPrimaryContract.landlordName,
                        normalizedFallbackContract.landlordName,
                        (row as any)?.landlordName,
                        (hydrated as any)?.landlordName,
                        (row as any)?.ownerName,
                        (hydrated as any)?.ownerName
                    ) ?? '';

                mergedContract.landlordContact =
                    pickString(
                        mergedContract.landlordContact,
                        normalizedPrimaryContract.landlordContact,
                        normalizedFallbackContract.landlordContact,
                        (row as any)?.landlordContact,
                        (hydrated as any)?.landlordContact,
                        (row as any)?.ownerContact,
                        (hydrated as any)?.ownerContact
                    ) ?? '';

                mergedContract.bankName = pickString(
                    mergedContract.bankName,
                    normalizedPrimaryContract.bankName,
                    normalizedFallbackContract.bankName,
                    (row as any)?.bankName,
                    (hydrated as any)?.bankName
                );

                mergedContract.accountNumber = pickString(
                    mergedContract.accountNumber,
                    normalizedPrimaryContract.accountNumber,
                    normalizedFallbackContract.accountNumber,
                    (row as any)?.accountNumber,
                    (hydrated as any)?.accountNumber,
                    (row as any)?.bankAccount,
                    (hydrated as any)?.bankAccount
                );

                mergedContract.accountHolder = pickString(
                    mergedContract.accountHolder,
                    normalizedPrimaryContract.accountHolder,
                    normalizedFallbackContract.accountHolder,
                    (row as any)?.accountHolder,
                    (hydrated as any)?.accountHolder
                );

                return {
                    id,
                    legacyId: rowLegacyId || (merged?.legacyId ? String(merged.legacyId) : undefined),
                    name: rowName || String(merged?.name ?? ''),
                    address: hasMeaningfulValue(addressSource) ? String(addressSource) : '',
                    type: normalizeAccommodationType((typeSource as any) ?? null),
                    status: normalizeAccommodationStatus((statusSource as any) ?? null),
                    ownership: normalizeOwnership((ownershipSource as any) ?? null),
                    contract: mergedContract,
                    costProfile: normalizeCostProfile(costProfileSource),
                    currentOccupantName: hasMeaningfulValue(occupantNameSource) ? String(occupantNameSource) : undefined,
                    currentOccupantPhone: hasMeaningfulValue(occupantPhoneSource) ? String(occupantPhoneSource) : undefined,
                    memo: hasMeaningfulValue(memoSource) ? String(memoSource) : undefined,
                    monthlyRent: mergedContract.monthlyRent,
                    deposit: mergedContract.deposit,
                    createdAt: toFirestoreTimestamp(createdAtSource),
                    updatedAt: toFirestoreTimestamp(updatedAtSource)
                } as any as Accommodation;
            })
            .sort((a: Accommodation, b: Accommodation) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));
    },

    async addAccommodation(data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const legacyId = (data as any)?.legacyId;
        const created = await createAccommodation(dc, {
            name: data.name,
            legacyId: legacyId ? String(legacyId) : null,
            address: data.address ?? null,
            type: data.type ?? null,
            status: data.status ?? null,
            ownership: data.ownership ?? null,
            contract: data.contract ? JSON.stringify(data.contract) : null,
            costProfile: data.costProfile ? JSON.stringify(data.costProfile) : null,
            currentOccupantName: data.currentOccupantName ?? null,
            currentOccupantPhone: data.currentOccupantPhone ?? null,
            memo: data.memo ?? null
        } as any);

        const id = (created as any)?.data?.accommodation_insert?.id ? String((created as any).data.accommodation_insert.id) : '';
        if (!id) throw new Error('Failed to create accommodation');

        await syncAccommodationFirestoreMirror(
            id,
            buildAccommodationFirestorePayload(
                {
                    ...data,
                    legacyId: legacyId ? String(legacyId) : null
                },
                true
            )
        );

        accommodationsLoaded = false;
        return id;
    },

    async updateAccommodation(id: string, data: Partial<Accommodation>): Promise<void> {
        const rawId = id ? String(id) : '';
        const uuid = await resolveAccommodationUuid(id);
        const targetId = uuid || rawId;
        if (!targetId) throw new Error('숙소를 찾을 수 없습니다.');
        const contractUpdate = data.contract as Partial<Contract> | undefined;
        const hasMonthlyRentUpdate = Boolean(
            contractUpdate && Object.prototype.hasOwnProperty.call(contractUpdate, 'monthlyRent')
        );
        const nextMonthlyRent = toFiniteNumber(contractUpdate?.monthlyRent);
        const targetAccommodationName = data.name ? String(data.name) : undefined;

        // DataConnect에 없는 숙소(레거시/Firestore 전용)도 수정 가능하게 처리
        if (!uuid) {
            await syncAccommodationFirestoreMirror(targetId, buildAccommodationFirestorePayload(data));
            if (hasMonthlyRentUpdate) {
                await syncCurrentMonthUtilityRentByName(targetAccommodationName, nextMonthlyRent);
            }
            accommodationsLoaded = false;
            return;
        }

        const vars: any = { id: uuid };
        if (data.name !== undefined) vars.name = data.name ?? null;
        if (data.address !== undefined) vars.address = data.address ?? null;
        if (data.type !== undefined) vars.type = data.type ?? null;
        if (data.status !== undefined) vars.status = data.status ?? null;
        if (data.ownership !== undefined) vars.ownership = data.ownership ?? null;
        if (data.contract !== undefined) vars.contract = data.contract ? JSON.stringify(data.contract) : null;
        if (data.costProfile !== undefined) vars.costProfile = data.costProfile ? JSON.stringify(data.costProfile) : null;
        if (data.currentOccupantName !== undefined) vars.currentOccupantName = data.currentOccupantName ?? null;
        if (data.currentOccupantPhone !== undefined) vars.currentOccupantPhone = data.currentOccupantPhone ?? null;
        if (data.memo !== undefined) vars.memo = data.memo ?? null;

        await updateAccommodation(dc, vars);
        const firestorePayload = buildAccommodationFirestorePayload(data);
        await syncAccommodationFirestoreMirror(uuid, firestorePayload);
        if (rawId && rawId !== uuid) {
            await syncAccommodationFirestoreMirror(rawId, firestorePayload);
        }

        if (hasMonthlyRentUpdate) {
            await syncCurrentMonthUtilityRent(
                uuid,
                nextMonthlyRent,
                targetAccommodationName
            );
            await syncCurrentMonthUtilityRentByName(targetAccommodationName, nextMonthlyRent);
        }

        accommodationsLoaded = false;
    },

    async deleteAccommodation(id: string): Promise<void> {
        const rawId = id ? String(id) : '';
        const uuid = await resolveAccommodationUuid(id);
        if (!uuid) return;
        await deleteAccommodation(dc, { id: uuid } as any);
        await Promise.all([
            deleteDoc(doc(db, 'accommodations', uuid)).catch(() => undefined),
            rawId && rawId !== uuid ? deleteDoc(doc(db, 'accommodations', rawId)).catch(() => undefined) : Promise.resolve()
        ]);
        accommodationsLoaded = false;
    },

    // --- Utility Record CRUD ---

    async getUtilityRecords(yearMonth: string): Promise<UtilityRecord[]> {
        const res = await listAllUtilityRecords(dc);
        const rows = (res as any)?.data?.utilityRecords ?? [];

        return rows
            .map((row: any) => {
                const accommodationId = row?.accommodation?.id
                    ? String(row.accommodation.id)
                    : (row?.accommodation?.legacyId ? String(row.accommodation.legacyId) : '');
                const costsRaw = safeJsonParse<UtilityCosts>(row?.costs, {
                    rent: 0,
                    electricity: 0,
                    gas: 0,
                    water: 0,
                    internet: 0,
                    maintenance: 0,
                    other: 0,
                    total: 0
                });
                const costs = normalizeUtilityCosts(costsRaw);

                return {
                    id: row?.legacyId ? String(row.legacyId) : String(row?.id ?? ''),
                    accommodationId,
                    accommodationName: row?.accommodationName ? String(row.accommodationName) : String(row?.accommodation?.name ?? ''),
                    yearMonth: String(row?.yearMonth ?? ''),
                    costs,
                    paymentDate: row?.paymentDate ? String(row.paymentDate) : undefined,
                    paymentStatus: normalizePaymentStatus(row?.paymentStatus ?? null),
                    memo: row?.memo ? String(row.memo) : undefined,
                    isAnomaly: typeof row?.isAnomaly === 'boolean' ? row.isAnomaly : undefined,
                    createdAt: toFirestoreTimestamp(row?.createdAt),
                    updatedAt: toFirestoreTimestamp(row?.updatedAt)
                } as UtilityRecord;
            })
            .filter((r: UtilityRecord) => String(r.yearMonth) === String(yearMonth));
    },

    // Batch creation/update for the "Smart Ledger" grid save
    async saveUtilityRecords(records: UtilityRecord[]): Promise<void> {
        if (records.length === 0) return;

        const tasks = records.map(async (record) => {
            const accommodationUuid = await resolveAccommodationUuid(record.accommodationId);
            if (!accommodationUuid) return;

            const costs = normalizeUtilityCosts(record.costs);
            const vars: any = {
                accommodationId: accommodationUuid,
                yearMonth: record.yearMonth,
                accommodationName: record.accommodationName ?? null,
                costs: JSON.stringify(costs),
                paymentDate: record.paymentDate ?? null,
                paymentStatus: record.paymentStatus ?? null,
                memo: record.memo ?? null,
                isAnomaly: typeof record.isAnomaly === 'boolean' ? record.isAnomaly : null
            };

            try {
                const updated = await updateUtilityRecord(dc, vars);
                const ok = (updated as any)?.data?.utilityRecord_update;
                if (ok) return;
            } catch {
                // ignore
            }

            const legacyId = record.id && !isUuidString(record.id) ? String(record.id) : null;
            await createUtilityRecord(dc, { ...vars, legacyId } as any);
        });

        await Promise.all(tasks);
    },

    async getRecordHistory(accommodationId: string): Promise<UtilityRecord[]> {
        const res = await listAllUtilityRecords(dc);
        const rows = (res as any)?.data?.utilityRecords ?? [];

        const rawId = accommodationId ? String(accommodationId) : '';
        const uuid = await resolveAccommodationUuid(rawId);
        const expectedUuid = uuid ? String(uuid) : null;

        return rows
            .map((row: any) => {
                const rowAccommodationUuid = String(row?.accommodation?.id ?? '');
                const accommodationIdOut = rowAccommodationUuid || (row?.accommodation?.legacyId ? String(row.accommodation.legacyId) : '');

                const costsRaw = safeJsonParse<UtilityCosts>(row?.costs, {
                    rent: 0,
                    electricity: 0,
                    gas: 0,
                    water: 0,
                    internet: 0,
                    maintenance: 0,
                    other: 0,
                    total: 0
                });

                return {
                    id: row?.legacyId ? String(row.legacyId) : String(row?.id ?? ''),
                    accommodationId: accommodationIdOut,
                    accommodationName: row?.accommodationName ? String(row.accommodationName) : String(row?.accommodation?.name ?? ''),
                    yearMonth: String(row?.yearMonth ?? ''),
                    costs: normalizeUtilityCosts(costsRaw),
                    paymentDate: row?.paymentDate ? String(row.paymentDate) : undefined,
                    paymentStatus: normalizePaymentStatus(row?.paymentStatus ?? null),
                    memo: row?.memo ? String(row.memo) : undefined,
                    isAnomaly: typeof row?.isAnomaly === 'boolean' ? row.isAnomaly : undefined,
                    createdAt: toFirestoreTimestamp(row?.createdAt),
                    updatedAt: toFirestoreTimestamp(row?.updatedAt)
                } as UtilityRecord;
            })
            .filter((r: UtilityRecord) => {
                if (!rawId) return false;
                if (r.accommodationId === rawId) return true;
                return expectedUuid ? r.accommodationId === expectedUuid : false;
            })
            .sort((a: UtilityRecord, b: UtilityRecord) => String(b.yearMonth).localeCompare(String(a.yearMonth), 'en'));
    },

    // --- Smart Logic: Get Ledger with Drafts ---
    async getMonthlyLedger(yearMonth: string): Promise<UtilityRecord[]> {
        // 1. Fetch all accommodations (to know what rows we need)
        const accommodations = await this.getAccommodations();

        // 2. Fetch existing records for this month
        const existingRecords = await this.getUtilityRecords(yearMonth);
        const recordMap = new Map(existingRecords.map(r => [r.accommodationId, r]));

        // 3. Merge: Create drafts for missing records based on Cost Profile
        const mergedRecords: UtilityRecord[] = accommodations.map(acc => {
            const profile = acc.costProfile;
            const contract = acc.contract;

            const getDefaultUtilityCost = (type: string, fixedVal?: number) => {
                if (type === 'included') return 0;
                if (type === 'fixed') return toFiniteNumber(fixedVal);
                return 0;
            };

            const defaultCosts = normalizeUtilityCosts({
                rent: toFiniteNumber(contract.monthlyRent),
                electricity: getDefaultUtilityCost(profile.electricity, profile.fixedElectricity),
                gas: getDefaultUtilityCost(profile.gas, profile.fixedGas),
                water: getDefaultUtilityCost(profile.water, profile.fixedWater),
                internet: getDefaultUtilityCost(profile.internet, profile.fixedInternet),
                maintenance: getDefaultUtilityCost(profile.maintenance, profile.fixedMaintenance),
                other: 0,
                total: 0
            });

            const existing = recordMap.get(acc.id);
            if (!existing) {
                return {
                    id: '',
                    accommodationId: acc.id,
                    accommodationName: acc.name,
                    yearMonth: yearMonth,
                    costs: defaultCosts,
                    paymentStatus: 'unpaid',
                    createdAt: null,
                    updatedAt: null
                };
            }

            // Keep persisted values, but auto-backfill defaults when key amounts are empty(0).
            const costs = normalizeUtilityCosts(existing.costs);
            if (costs.rent <= 0 && defaultCosts.rent > 0) {
                costs.rent = defaultCosts.rent;
            }

            if (profile.electricity === 'included') costs.electricity = 0;
            if (profile.gas === 'included') costs.gas = 0;
            if (profile.water === 'included') costs.water = 0;
            if (profile.internet === 'included') costs.internet = 0;
            if (profile.maintenance === 'included') costs.maintenance = 0;

            if (profile.electricity === 'fixed' && costs.electricity <= 0 && defaultCosts.electricity > 0) costs.electricity = defaultCosts.electricity;
            if (profile.gas === 'fixed' && costs.gas <= 0 && defaultCosts.gas > 0) costs.gas = defaultCosts.gas;
            if (profile.water === 'fixed' && costs.water <= 0 && defaultCosts.water > 0) costs.water = defaultCosts.water;
            if (profile.internet === 'fixed' && costs.internet <= 0 && defaultCosts.internet > 0) costs.internet = defaultCosts.internet;
            if (profile.maintenance === 'fixed' && costs.maintenance <= 0 && defaultCosts.maintenance > 0) costs.maintenance = defaultCosts.maintenance;

            costs.total =
                costs.rent +
                costs.electricity +
                costs.gas +
                costs.water +
                costs.internet +
                costs.maintenance +
                costs.other;

            return {
                ...existing,
                accommodationName: existing.accommodationName || acc.name,
                costs
            };
        });

        return mergedRecords;
    }
};
