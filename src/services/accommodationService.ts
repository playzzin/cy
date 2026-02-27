import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listAllAccommodations,
        createAccommodation,
    updateAccommodation,
    deleteAccommodation,
    listAllUtilityRecords,
    createUtilityRecord,
    updateUtilityRecord
} from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';
import { Accommodation, UtilityRecord, UtilityCosts, Contract, CostProfile } from '../types/accommodation';
import { AccommodationAssignment } from '../types/accommodationAssignment';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { app } from '../firebase/config';

const dc = getDataConnect(app, connectorConfig);

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

// Removed loadFirestoreAccommodations as we are consolidating to Data Connect.

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

// Removed buildAccommodationFirestorePayload as Firestore mirroring is being deprecated.

// Removed syncAccommodationFirestoreMirror as Firestore mirroring is being deprecated.

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

        return rows.map((row: any) => {
            const id = row?.id ? String(row.id) : (row?.legacyId ? String(row.legacyId) : '');

            // Map flat fields to nested Contract object
            const contract: Contract = {
                startDate: row.contractStartDate ?? '',
                endDate: row.contractEndDate ?? '',
                deposit: toFiniteNumber(row.deposit),
                monthlyRent: toFiniteNumber(row.monthlyRent),
                paymentDay: toFiniteNumber(row.paymentDay, 1),
                landlordName: row.landlordName ?? '',
                landlordContact: row.landlordContact ?? '',
                isReported: Boolean(row.isReported),
                bankName: row.bankName ?? undefined,
                accountNumber: row.accountNumber ?? undefined,
                accountHolder: row.accountHolder ?? undefined,
                rentPayDate: toFiniteNumber(row.rentPayDate, 1),
                isAutoTransfer: row.isAutoTransfer ?? undefined,
                transferDay: row.transferDay ?? undefined,
                transferAccountInfo: row.transferAccountInfo ?? undefined
            };

            // Map flat fields to nested CostProfile object
            const costProfile: CostProfile = {
                electricity: (row.electricityMode as any) || 'variable',
                gas: (row.gasMode as any) || 'variable',
                water: (row.waterMode as any) || 'variable',
                internet: (row.internetMode as any) || 'variable',
                maintenance: (row.maintenanceMode as any) || 'variable',
                fixedElectricity: toOptionalFiniteNumber(row.fixedElectricity),
                fixedGas: toOptionalFiniteNumber(row.fixedGas),
                fixedWater: toOptionalFiniteNumber(row.fixedWater),
                fixedInternet: toOptionalFiniteNumber(row.fixedInternet),
                fixedMaintenance: toOptionalFiniteNumber(row.fixedMaintenance)
            };

            return {
                id,
                legacyId: row?.legacyId ? String(row.legacyId) : undefined,
                name: String(row?.name ?? ''),
                address: row?.address ?? '',
                type: normalizeAccommodationType(row?.type ?? null),
                status: normalizeAccommodationStatus(row?.status ?? null),
                ownership: normalizeOwnership(row?.ownership ?? null),
                contract,
                costProfile,
                billingTargetType: row.billingTargetType ?? undefined,
                billingTargetTeamId: row.billingTargetTeamId ?? undefined,
                billingTargetTeamName: row.billingTargetTeamName ?? undefined,
                billingTargetWorkerId: row.billingTargetWorkerId ?? undefined,
                billingTargetWorkerName: row.billingTargetWorkerName ?? undefined,
                currentOccupantName: row?.currentOccupantName ?? undefined,
                currentOccupantPhone: row?.currentOccupantPhone ?? undefined,
                memo: row?.memo ?? undefined,
                monthlyRent: contract.monthlyRent,
                deposit: contract.deposit,
                createdAt: toFirestoreTimestamp(row?.createdAt),
                updatedAt: toFirestoreTimestamp(row?.updatedAt)
            } as any as Accommodation;
        }).sort((a: Accommodation, b: Accommodation) => (a.name || '').localeCompare(b.name || '', 'ko-KR'));
    },

    async addAccommodation(data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const legacyId = (data as any)?.legacyId;
        const c = data.contract || ({} as Contract);
        const p = data.costProfile || ({} as CostProfile);

        const created = await createAccommodation(dc, {
            name: data.name,
            legacyId: legacyId ? String(legacyId) : null,
            address: data.address ?? null,
            type: data.type ?? null,
            status: data.status ?? null,
            ownership: data.ownership ?? null,
            // Contract fields flat
            contractStartDate: c.startDate ?? null,
            contractEndDate: c.endDate ?? null,
            deposit: toFiniteNumber(c.deposit),
            monthlyRent: toFiniteNumber(c.monthlyRent),
            paymentDay: toFiniteNumber(c.paymentDay, 1),
            landlordName: c.landlordName ?? null,
            landlordContact: c.landlordContact ?? null,
            isReported: Boolean(c.isReported),
            bankName: c.bankName ?? null,
            accountNumber: c.accountNumber ?? null,
            accountHolder: c.accountHolder ?? null,
            rentPayDate: toFiniteNumber(c.rentPayDate, 1),
            isAutoTransfer: c.isAutoTransfer ?? null,
            transferDay: toOptionalFiniteNumber(c.transferDay) ?? null,
            transferAccountInfo: c.transferAccountInfo ?? null,
            // CostProfile fields flat
            electricityMode: p.electricity ?? null,
            gasMode: p.gas ?? null,
            waterMode: p.water ?? null,
            internetMode: p.internet ?? null,
            maintenanceMode: p.maintenance ?? null,
            fixedElectricity: toOptionalFiniteNumber(p.fixedElectricity) ?? null,
            fixedGas: toOptionalFiniteNumber(p.fixedGas) ?? null,
            fixedWater: toOptionalFiniteNumber(p.fixedWater) ?? null,
            fixedInternet: toOptionalFiniteNumber(p.fixedInternet) ?? null,
            fixedMaintenance: toOptionalFiniteNumber(p.fixedMaintenance) ?? null,
            // Targeting
            billingTargetType: (data as any).billingTargetType ?? null,
            billingTargetTeamId: (data as any).billingTargetTeamId ?? null,
            billingTargetTeamName: (data as any).billingTargetTeamName ?? null,
            billingTargetWorkerId: (data as any).billingTargetWorkerId ?? null,
            billingTargetWorkerName: (data as any).billingTargetWorkerName ?? null,
            currentOccupantName: data.currentOccupantName ?? null,
            currentOccupantPhone: data.currentOccupantPhone ?? null,
            memo: data.memo ?? null
        } as any);

        const id = (created as any)?.data?.accommodation_insert?.id ? String((created as any).data.accommodation_insert.id) : '';
        if (!id) throw new Error('Failed to create accommodation');

        accommodationsLoaded = false;
        return id;
    },

    async updateAccommodation(id: string, data: Partial<Accommodation>): Promise<void> {
        const rawId = id ? String(id) : '';
        const uuid = await resolveAccommodationUuid(id);
        const targetId = uuid || rawId;
        if (!targetId) throw new Error('숙소를 찾을 수 없습니다.');

        const contractUpdate = data.contract as Partial<Contract> | undefined;
        const profileUpdate = data.costProfile as Partial<CostProfile> | undefined;

        const hasMonthlyRentUpdate = Boolean(
            contractUpdate && Object.prototype.hasOwnProperty.call(contractUpdate, 'monthlyRent')
        );
        const nextMonthlyRent = toFiniteNumber(contractUpdate?.monthlyRent);
        const targetAccommodationName = data.name ? String(data.name) : undefined;

        if (!uuid) {
            throw new Error('숙소를 찾을 수 없습니다.');
        }

        const vars: any = { id: uuid };
        if (data.name !== undefined) vars.name = data.name ?? null;
        if (data.address !== undefined) vars.address = data.address ?? null;
        if (data.type !== undefined) vars.type = data.type ?? null;
        if (data.status !== undefined) vars.status = data.status ?? null;
        if (data.ownership !== undefined) vars.ownership = data.ownership ?? null;

        // Flatten Contract updates
        if (contractUpdate) {
            if (contractUpdate.startDate !== undefined) vars.contractStartDate = contractUpdate.startDate ?? null;
            if (contractUpdate.endDate !== undefined) vars.contractEndDate = contractUpdate.endDate ?? null;
            if (contractUpdate.deposit !== undefined) vars.deposit = toFiniteNumber(contractUpdate.deposit);
            if (contractUpdate.monthlyRent !== undefined) vars.monthlyRent = toFiniteNumber(contractUpdate.monthlyRent);
            if (contractUpdate.paymentDay !== undefined) vars.paymentDay = toFiniteNumber(contractUpdate.paymentDay, 1);
            if (contractUpdate.landlordName !== undefined) vars.landlordName = contractUpdate.landlordName ?? null;
            if (contractUpdate.landlordContact !== undefined) vars.landlordContact = contractUpdate.landlordContact ?? null;
            if (contractUpdate.isReported !== undefined) vars.isReported = Boolean(contractUpdate.isReported);
            if (contractUpdate.bankName !== undefined) vars.bankName = contractUpdate.bankName ?? null;
            if (contractUpdate.accountNumber !== undefined) vars.accountNumber = contractUpdate.accountNumber ?? null;
            if (contractUpdate.accountHolder !== undefined) vars.accountHolder = contractUpdate.accountHolder ?? null;
            if (contractUpdate.rentPayDate !== undefined) vars.rentPayDate = toFiniteNumber(contractUpdate.rentPayDate, 1);
            if (contractUpdate.isAutoTransfer !== undefined) vars.isAutoTransfer = contractUpdate.isAutoTransfer ?? null;
            if (contractUpdate.transferDay !== undefined) vars.transferDay = toOptionalFiniteNumber(contractUpdate.transferDay) ?? null;
            if (contractUpdate.transferAccountInfo !== undefined) vars.transferAccountInfo = contractUpdate.transferAccountInfo ?? null;
        }

        // Flatten CostProfile updates
        if (profileUpdate) {
            if (profileUpdate.electricity !== undefined) vars.electricityMode = profileUpdate.electricity ?? null;
            if (profileUpdate.gas !== undefined) vars.gasMode = profileUpdate.gas ?? null;
            if (profileUpdate.water !== undefined) vars.waterMode = profileUpdate.water ?? null;
            if (profileUpdate.internet !== undefined) vars.internetMode = profileUpdate.internet ?? null;
            if (profileUpdate.maintenance !== undefined) vars.maintenanceMode = profileUpdate.maintenance ?? null;
            if (profileUpdate.fixedElectricity !== undefined) vars.fixedElectricity = toOptionalFiniteNumber(profileUpdate.fixedElectricity) ?? null;
            if (profileUpdate.fixedGas !== undefined) vars.fixedGas = toOptionalFiniteNumber(profileUpdate.fixedGas) ?? null;
            if (profileUpdate.fixedWater !== undefined) vars.fixedWater = toOptionalFiniteNumber(profileUpdate.fixedWater) ?? null;
            if (profileUpdate.fixedInternet !== undefined) vars.fixedInternet = toOptionalFiniteNumber(profileUpdate.fixedInternet) ?? null;
            if (profileUpdate.fixedMaintenance !== undefined) vars.fixedMaintenance = toOptionalFiniteNumber(profileUpdate.fixedMaintenance) ?? null;
        }

        // Flatten Targeting updates
        if ((data as any).billingTargetType !== undefined) vars.billingTargetType = (data as any).billingTargetType ?? null;
        if ((data as any).billingTargetTeamId !== undefined) vars.billingTargetTeamId = (data as any).billingTargetTeamId ?? null;
        if ((data as any).billingTargetTeamName !== undefined) vars.billingTargetTeamName = (data as any).billingTargetTeamName ?? null;
        if ((data as any).billingTargetWorkerId !== undefined) vars.billingTargetWorkerId = (data as any).billingTargetWorkerId ?? null;
        if ((data as any).billingTargetWorkerName !== undefined) vars.billingTargetWorkerName = (data as any).billingTargetWorkerName ?? null;

        if (data.currentOccupantName !== undefined) vars.currentOccupantName = data.currentOccupantName ?? null;
        if (data.currentOccupantPhone !== undefined) vars.currentOccupantPhone = data.currentOccupantPhone ?? null;
        if (data.memo !== undefined) vars.memo = data.memo ?? null;

        await updateAccommodation(dc, vars);


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
