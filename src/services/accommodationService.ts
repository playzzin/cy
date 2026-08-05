import { accommodationFirestoreService } from './accommodationFirestoreService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';
import { Accommodation, UtilityRecord } from '../types/accommodation';
import { AccommodationAssignment } from '../types/accommodationAssignment';
import { DEFAULT_SUPPORT_BILLING_START_DATE, isSupportBillingMonthEnabled, maxIsoDate, minIsoDate, normalizeDateText } from '../utils/supportBillingPeriod';

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
    const rent = Number(existingCosts.rent ?? 0) || Number(accommodation.contract?.monthlyRent ?? 0) || 0;
    const electricity = Number(existingCosts.electricity ?? 0) || fixedElectricity;
    const gas = Number(existingCosts.gas ?? 0) || fixedGas;
    const water = Number(existingCosts.water ?? 0) || fixedWater;
    const internet = Number(existingCosts.internet ?? 0) || fixedInternet;
    const maintenance = Number(existingCosts.maintenance ?? 0) || fixedMaintenance;
    const other = Number(existingCosts.other ?? 0) || 0;
    const total = rent + electricity + gas + water + internet + maintenance + other;
    const paymentDay = accommodation.contract?.rentPayDate ?? accommodation.contract?.paymentDay;
    const defaultPaymentDate = getMonthPaymentDate(yearMonth, paymentDay);

    return {
        id: String(existing?.id ?? makeId('utility_record')),
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
        return accommodationFirestoreService.listUtilityRecords(yearMonth);
    },

    getMonthlyLedger: async (yearMonth: string): Promise<UtilityRecord[]> => {
        const [accommodations, utilityRecords, billingTargets] = await Promise.all([
            accommodationFirestoreService.listAccommodations(),
            accommodationFirestoreService.listUtilityRecords(yearMonth),
            accommodationBillingTargetService.listTargets().catch(() => [])
        ]);

        const existingByAccommodationId = new Map<string, UtilityRecord>();
        utilityRecords.forEach((record) => {
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
        const id = data.id ? String(data.id) : makeId('utility_record');
        await accommodationFirestoreService.saveUtilityRecord({ ...data, id } as Partial<UtilityRecord> & { id: string });
    },

    saveUtilityRecords: async (records: Array<Partial<UtilityRecord> & { id?: string }>) => {
        await Promise.all(records.map((record) => accommodationService.saveUtilityRecord(record)));
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
