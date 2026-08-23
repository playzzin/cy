import type { UtilityRecord } from '../types/accommodation';
import { Timestamp } from '../types/timestamp';
import { accommodationFirestoreService } from './accommodationFirestoreService';
import { accommodationService } from './accommodationService';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';

jest.mock('./accommodationFirestoreService', () => ({
    accommodationFirestoreService: {
        listAccommodations: jest.fn(),
        listUtilityRecords: jest.fn(),
        saveAccommodation: jest.fn(),
        deleteAccommodation: jest.fn(),
        getAccommodation: jest.fn(),
        saveUtilityRecord: jest.fn(),
        replaceUtilityRecord: jest.fn(),
        deleteUtilityRecord: jest.fn(),
        getLatestUtilityRecord: jest.fn(),
    },
}));

jest.mock('./accommodationAssignmentService', () => ({
    accommodationAssignmentService: {
        getAssignmentsByAccommodation: jest.fn(),
        getAllAssignments: jest.fn(),
    },
}));

jest.mock('./accommodationBillingTargetService', () => ({
    accommodationBillingTargetService: {
        listTargets: jest.fn(),
    },
}));

const mockedListUtilityRecords = accommodationFirestoreService.listUtilityRecords as jest.MockedFunction<
    typeof accommodationFirestoreService.listUtilityRecords
>;
const mockedListAccommodations = accommodationFirestoreService.listAccommodations as jest.MockedFunction<
    typeof accommodationFirestoreService.listAccommodations
>;
const mockedListBillingTargets = accommodationBillingTargetService.listTargets as jest.MockedFunction<
    typeof accommodationBillingTargetService.listTargets
>;
const mockedSaveUtilityRecord = accommodationFirestoreService.saveUtilityRecord as jest.MockedFunction<
    typeof accommodationFirestoreService.saveUtilityRecord
>;
const mockedReplaceUtilityRecord = accommodationFirestoreService.replaceUtilityRecord as jest.MockedFunction<
    typeof accommodationFirestoreService.replaceUtilityRecord
>;
const mockedDeleteUtilityRecord = accommodationFirestoreService.deleteUtilityRecord as jest.MockedFunction<
    typeof accommodationFirestoreService.deleteUtilityRecord
>;

const buildRecord = (patch: Partial<UtilityRecord> = {}): UtilityRecord => ({
    id: 'legacy-id',
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
    ...patch,
});

describe('accommodationService saved utility ledger boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSaveUtilityRecord.mockResolvedValue(undefined);
        mockedListBillingTargets.mockResolvedValue([]);
    });

    it('returns only an actually stored record and prefers the newest duplicate', async () => {
        const canonical = buildRecord({
            id: 'utility_2026-06_room%2F204',
            updatedAt: Timestamp.fromMillis(1000),
        });
        const newerLegacy = buildRecord({
            id: 'legacy-newer',
            costs: { ...buildRecord().costs, electricity: 25000, total: 25000 },
            updatedAt: Timestamp.fromMillis(2000),
        });
        mockedListUtilityRecords.mockResolvedValue([canonical, newerLegacy]);

        await expect(accommodationService.getSavedUtilityRecord('room/204', '2026-06'))
            .resolves.toEqual(newerLegacy);
    });

    it('returns null when the generated screen row has never been saved', async () => {
        mockedListUtilityRecords.mockResolvedValue([]);

        await expect(accommodationService.getSavedUtilityRecord('room/204', '2026-06'))
            .resolves.toBeNull();
    });

    it('uses the deterministic accommodation/month id for a new saved row', async () => {
        const record = buildRecord();
        const { id: _ignored, ...withoutId } = record;

        await accommodationService.saveUtilityRecord(withoutId);

        expect(mockedSaveUtilityRecord).toHaveBeenCalledWith(expect.objectContaining({
            id: 'utility_2026-06_room%2F204',
            accommodationId: 'room/204',
            yearMonth: '2026-06',
        }));
    });

    it('deletes only the exact newly stored row when an automatic-billing save must roll back', async () => {
        mockedDeleteUtilityRecord.mockResolvedValue(undefined);

        await accommodationService.deleteUtilityRecord('utility_2026-06_room%2F204');

        expect(mockedDeleteUtilityRecord).toHaveBeenCalledTimes(1);
        expect(mockedDeleteUtilityRecord).toHaveBeenCalledWith('utility_2026-06_room%2F204');
    });

    it('fully replaces an existing row with its previous snapshot during rollback', async () => {
        mockedReplaceUtilityRecord.mockResolvedValue(undefined);
        const previous = buildRecord({ billingSyncPending: false });

        await accommodationService.replaceUtilityRecord(previous);

        expect(mockedReplaceUtilityRecord).toHaveBeenCalledTimes(1);
        expect(mockedReplaceUtilityRecord).toHaveBeenCalledWith(previous);
    });

    it('persists the billing retry marker with the utility ledger row', async () => {
        await accommodationService.saveUtilityRecord(buildRecord({ billingSyncPending: true }));

        expect(mockedSaveUtilityRecord).toHaveBeenCalledWith(expect.objectContaining({
            id: 'legacy-id',
            accommodationId: 'room/204',
            yearMonth: '2026-06',
            billingSyncPending: true,
        }));
    });

    it('persists a cleared retry marker after billing sync succeeds', async () => {
        await accommodationService.saveUtilityRecord(buildRecord({ billingSyncPending: false }));

        expect(mockedSaveUtilityRecord).toHaveBeenCalledWith(expect.objectContaining({
            id: 'legacy-id',
            billingSyncPending: false,
        }));
    });

    it('keeps a persisted retry marker when rebuilding the monthly ledger view', async () => {
        mockedListAccommodations.mockResolvedValue([{
            id: 'room/204',
            name: '204호',
            address: '',
            type: 'OneRoom',
            status: 'active',
            ownership: 'Cheongyeon',
            contract: {
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                deposit: 0,
                monthlyRent: 0,
                paymentDay: 1,
                landlordName: '',
                landlordContact: '',
                isReported: false,
            },
            costProfile: {
                electricity: 'variable',
                gas: 'variable',
                water: 'variable',
                internet: 'variable',
                maintenance: 'variable',
            },
        }]);
        mockedListUtilityRecords.mockResolvedValue([buildRecord({ billingSyncPending: true })]);

        const ledger = await accommodationService.getMonthlyLedger('2026-06');

        expect(ledger).toHaveLength(1);
        expect(ledger[0].billingSyncPending).toBe(true);
    });

    it('keeps explicitly stored zero costs instead of restoring contract and fixed defaults', async () => {
        mockedListAccommodations.mockResolvedValue([{
            id: 'room/204',
            name: '204호',
            address: '',
            type: 'OneRoom',
            status: 'active',
            ownership: 'Cheongyeon',
            contract: {
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                deposit: 0,
                monthlyRent: 500000,
                paymentDay: 1,
                landlordName: '',
                landlordContact: '',
                isReported: false,
            },
            costProfile: {
                electricity: 'fixed',
                fixedElectricity: 20000,
                gas: 'variable',
                water: 'variable',
                internet: 'variable',
                maintenance: 'variable',
            },
        }]);
        mockedListUtilityRecords.mockResolvedValue([buildRecord({
            costs: {
                rent: 0,
                electricity: 0,
                gas: 0,
                water: 0,
                internet: 0,
                maintenance: 0,
                other: 0,
                total: 0,
            },
        })]);

        const ledger = await accommodationService.getMonthlyLedger('2026-06');

        expect(ledger[0].costs).toEqual(expect.objectContaining({
            rent: 0,
            electricity: 0,
            total: 0,
        }));
    });
});
