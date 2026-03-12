import { accommodationFirestoreService } from './accommodationFirestoreService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { Accommodation, UtilityRecord } from '../types/accommodation';
import { AccommodationAssignment } from '../types/accommodationAssignment';

const makeId = (prefix: string): string => {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const buildUtilityRecord = (
    accommodation: Accommodation,
    yearMonth: string,
    existing?: Partial<UtilityRecord> | null
): UtilityRecord => {
    const existingCosts = existing?.costs ?? ({} as Partial<UtilityRecord['costs']>);
    const rent = Number(existingCosts.rent ?? accommodation.contract?.monthlyRent ?? 0) || 0;
    const electricity = Number(existingCosts.electricity ?? 0) || 0;
    const gas = Number(existingCosts.gas ?? 0) || 0;
    const water = Number(existingCosts.water ?? 0) || 0;
    const internet = Number(existingCosts.internet ?? 0) || 0;
    const maintenance = Number(existingCosts.maintenance ?? 0) || 0;
    const other = Number(existingCosts.other ?? 0) || 0;
    const total = Number(existingCosts.total ?? (rent + electricity + gas + water + internet + maintenance + other)) || 0;

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
        paymentDate: existing?.paymentDate,
        paymentStatus: existing?.paymentStatus ?? 'unpaid',
        memo: existing?.memo,
        isAnomaly: existing?.isAnomaly,
        createdAt: existing?.createdAt,
        updatedAt: existing?.updatedAt
    };
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
        const [accommodations, utilityRecords] = await Promise.all([
            accommodationFirestoreService.listAccommodations(),
            accommodationFirestoreService.listUtilityRecords(yearMonth)
        ]);

        const existingByAccommodationId = new Map<string, UtilityRecord>();
        utilityRecords.forEach((record) => {
            const key = String(record.accommodationId ?? '').trim();
            if (key) {
                existingByAccommodationId.set(key, record);
            }
        });

        return accommodations.map((accommodation) => buildUtilityRecord(
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
