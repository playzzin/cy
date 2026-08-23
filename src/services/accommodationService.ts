import { accommodationFirestoreService } from './accommodationFirestoreService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';
import { Accommodation, UtilityRecord } from '../types/accommodation';
import { AccommodationAssignment } from '../types/accommodationAssignment';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate, normalizeDateText } from '../utils/supportBillingPeriod';
import {
    buildAccommodationUtilityRecordId,
    dedupeAccommodationUtilityRecords,
    dedupeAccommodationUtilityRecordWrites,
} from '../utils/accommodationUtilityDeduplication';

const makeId = (prefix: string): string => {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getMonthPaymentDate = (yearMonth: string, rawDay?: number): string | undefined => {
    const matched = /^(\d{4})-(\d{2})$/.exec(String(yearMonth ?? '').trim());
    const paymentDay = Number(rawDay ?? 0);
    if (!matched || !Number.isFinite(paymentDay) || paymentDay <= 0) return undefined;

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(Math.max(1, Math.floor(paymentDay)), lastDay);
    return `${matched[1]}-${matched[2]}-${String(day).padStart(2, '0')}`;
};

const normalizeUtilityMemo = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim() ? value : '';
};

const getStoredUtilityCostOrDefault = (
    existingCosts: Partial<UtilityRecord['costs']>,
    field: keyof UtilityRecord['costs'],
    fallback: number
): number => {
    const stored = existingCosts[field];
    if (stored === undefined || stored === null) return fallback;
    const amount = Number(stored);
    return Number.isFinite(amount) ? amount : 0;
};

const buildUtilityRecord = (
    accommodation: Accommodation,
    yearMonth: string,
    existing?: Partial<UtilityRecord> | null
): UtilityRecord => {
    const existingCosts = existing?.costs ?? ({} as Partial<UtilityRecord['costs']>);
    const costProfile = accommodation.costProfile;
    const fixedElectricity = costProfile?.electricity === 'fixed' ? Number(costProfile.fixedElectricity ?? 0) || 0 : 0;
    const fixedGas = costProfile?.gas === 'fixed' ? Number(costProfile.fixedGas ?? 0) || 0 : 0;
    const fixedWater = costProfile?.water === 'fixed' ? Number(costProfile.fixedWater ?? 0) || 0 : 0;
    const fixedInternet = costProfile?.internet === 'fixed' ? Number(costProfile.fixedInternet ?? 0) || 0 : 0;
    const fixedMaintenance = costProfile?.maintenance === 'fixed' ? Number(costProfile.fixedMaintenance ?? 0) || 0 : 0;
    const rent = getStoredUtilityCostOrDefault(
        existingCosts,
        'rent',
        Number(accommodation.contract?.monthlyRent ?? 0) || 0
    );
    const electricity = getStoredUtilityCostOrDefault(existingCosts, 'electricity', fixedElectricity);
    const gas = getStoredUtilityCostOrDefault(existingCosts, 'gas', fixedGas);
    const water = getStoredUtilityCostOrDefault(existingCosts, 'water', fixedWater);
    const internet = getStoredUtilityCostOrDefault(existingCosts, 'internet', fixedInternet);
    const maintenance = getStoredUtilityCostOrDefault(existingCosts, 'maintenance', fixedMaintenance);
    const other = getStoredUtilityCostOrDefault(existingCosts, 'other', 0);
    const total = rent + electricity + gas + water + internet + maintenance + other;
    const paymentDay = accommodation.contract?.rentPayDate ?? accommodation.contract?.paymentDay;
    const defaultPaymentDate = getMonthPaymentDate(yearMonth, paymentDay);

    return {
        id: String(existing?.id ?? buildAccommodationUtilityRecordId(accommodation.id, yearMonth)),
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        yearMonth,
        costs: {
            rent,
            electricity,
            gas,
            water,
            internet,
            maintenance,
            other,
            total
        },
        paymentDate: existing?.paymentDate || defaultPaymentDate,
        paymentStatus: existing?.paymentStatus ?? 'unpaid',
        memo: normalizeUtilityMemo(existing?.memo),
        electricityBillImport: existing?.electricityBillImport,
        gasBillImport: existing?.gasBillImport,
        waterBillImport: existing?.waterBillImport,
        billingSyncPending: existing?.billingSyncPending,
        isAnomaly: existing?.isAnomaly,
        createdAt: existing?.createdAt,
        updatedAt: existing?.updatedAt
    };
};

const getYearMonthStartDateText = (yearMonth: string): string => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth ?? '').trim());
    if (!match) return '';
    return `${match[1]}-${match[2]}-01`;
};

const isAccommodationBillableForMonth = (accommodation: Accommodation, yearMonth: string): boolean => {
    if (accommodation.status && accommodation.status !== 'active') return false;

    const monthStart = getYearMonthStartDateText(yearMonth);
    const contractEndDate = normalizeDateText(accommodation.contract?.endDate);
    // A contract that ends during this month still needs its final utility
    // settlement. Exclude it only from months that start after the contract.
    if (monthStart && contractEndDate && contractEndDate < monthStart) return false;

    return true;
};

export const accommodationService = {
    listAllAccommodations: async (status?: 'active' | 'inactive') => {
        return accommodationFirestoreService.listAccommodations(status);
    },

    getAccommodations: async (status?: 'active' | 'inactive') => {
        return accommodationFirestoreService.listAccommodations(status);
    },

    getAccommodation: async (id: string) => {
        return accommodationFirestoreService.getAccommodation(id);
    },

    addAccommodation: async (data: Omit<Accommodation, 'id'>) => {
        const id = makeId('accommodation');
        const next = { ...data, id } as Accommodation;
        await accommodationFirestoreService.saveAccommodation(next);
        return next;
    },

    createAccommodation: async (data: Omit<Accommodation, 'id'>) => {
        return accommodationService.addAccommodation(data);
    },

    updateAccommodation: async (id: string, data: Partial<Accommodation>) => {
        await accommodationFirestoreService.saveAccommodation({ ...data, id } as Accommodation);
    },

    deleteAccommodation: async (id: string) => {
        await accommodationFirestoreService.deleteAccommodation(id);
    },

    listAllUtilityRecords: async (yearMonth?: string) => {
        const records = await accommodationFirestoreService.listUtilityRecords(yearMonth);
        return dedupeAccommodationUtilityRecords(records);
    },

    getSavedUtilityRecord: async (accommodationId: string, yearMonth: string): Promise<UtilityRecord | null> => {
        const normalizedAccommodationId = String(accommodationId ?? '').trim();
        if (!normalizedAccommodationId || !/^\d{4}-\d{2}$/.test(String(yearMonth ?? '').trim())) return null;
        const records = dedupeAccommodationUtilityRecords(
            await accommodationFirestoreService.listUtilityRecords(yearMonth)
        );
        return records.find((record) => String(record.accommodationId ?? '').trim() === normalizedAccommodationId) ?? null;
    },

    getMonthlyLedger: async (yearMonth: string): Promise<UtilityRecord[]> => {
        const [accommodations, utilityRecords, billingTargets] = await Promise.all([
            accommodationFirestoreService.listAccommodations(),
            accommodationFirestoreService.listUtilityRecords(yearMonth),
            accommodationBillingTargetService.listTargets().catch(() => [])
        ]);

        const existingByAccommodationId = new Map<string, UtilityRecord>();
        dedupeAccommodationUtilityRecords(utilityRecords).forEach((record) => {
            const key = String(record.accommodationId ?? '').trim();
            if (key) {
                existingByAccommodationId.set(key, record);
            }
        });

        return accommodations
            .filter((accommodation) => {
                if (!isAccommodationBillableForMonth(accommodation, yearMonth)) return false;

                const accommodationId = String(accommodation.id ?? '').trim();
                const accommodationName = String(accommodation.name ?? '').trim();
                const firstBillingTargetStart = minIsoDate(
                    ...billingTargets
                        .filter((target) => {
                            const targetAccommodationId = String(target.accommodationId ?? '').trim();
                            const targetAccommodationName = String(target.accommodationName ?? '').trim();
                            return (
                                (accommodationId && targetAccommodationId === accommodationId) ||
                                (accommodationName && targetAccommodationName === accommodationName)
                            );
                        })
                        .map((target) => target.startDate)
                );
                const billingStartDate = maxIsoDate(
                    DEFAULT_SUPPORT_BILLING_START_DATE,
                    accommodation.contract?.startDate,
                    firstBillingTargetStart
                );
                return isSupportBillingMonthEnabled(yearMonth, billingStartDate);
            })
            .map((accommodation) => buildUtilityRecord(
                accommodation,
                yearMonth,
                existingByAccommodationId.get(String(accommodation.id)) ?? null
            ));
    },

    saveUtilityRecord: async (data: Partial<UtilityRecord> & { id?: string }) => {
        const accommodationId = String(data.accommodationId ?? '').trim();
        const yearMonth = String(data.yearMonth ?? '').trim();
        if (!accommodationId || !/^\d{4}-\d{2}$/.test(yearMonth)) {
            throw new Error('공과금 대장 저장에는 숙소와 yyyy-MM 형식의 대장 월이 필요합니다.');
        }
        const id = data.id
            ? String(data.id)
            : buildAccommodationUtilityRecordId(accommodationId, yearMonth);
        await accommodationFirestoreService.saveUtilityRecord({ ...data, id } as Partial<UtilityRecord> & { id: string });
    },

    saveUtilityRecords: async (records: Array<Partial<UtilityRecord> & { id?: string }>) => {
        const uniqueRecords = dedupeAccommodationUtilityRecordWrites(records);
        await Promise.all(uniqueRecords.map((record) => accommodationService.saveUtilityRecord(record)));
    },

    replaceUtilityRecord: async (record: UtilityRecord) => {
        await accommodationFirestoreService.replaceUtilityRecord(record);
    },

    deleteUtilityRecord: async (id: string) => {
        await accommodationFirestoreService.deleteUtilityRecord(id);
    },

    getLatestUtilityRecord: async (accommodationId: string) => {
        return accommodationFirestoreService.getLatestUtilityRecord(accommodationId);
    },

    listAssignments: async (accommodationId: string): Promise<AccommodationAssignment[]> => {
        return accommodationAssignmentService.getAssignmentsByAccommodation(accommodationId);
    },

    getAssignments: async (accommodationId?: string): Promise<AccommodationAssignment[]> => {
        if (accommodationId) {
            return accommodationAssignmentService.getAssignmentsByAccommodation(accommodationId);
        }
        return accommodationAssignmentService.getAllAssignments();
    }
};
