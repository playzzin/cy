import { getAllMaterials } from './materialService';
import { accommodationService } from './accommodationService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { vehicleService } from './vehicleService';

export type Batch2MigrationSummary = {
    mode: 'firestore-only';
    skippedLegacyRead: true;
    collections: {
        materials: number;
        accommodations: number;
        accommodationAssignments: number;
        utilityRecords: number;
        vehicles: number;
        vehicleAssignments: number;
        vehicleExpenses: number;
    };
    message: string;
};

const safeCount = async <T>(load: () => Promise<T[]>): Promise<number> => {
    try {
        const rows = await load();
        return Array.isArray(rows) ? rows.length : 0;
    } catch {
        return 0;
    }
};

export const coreMigrationService = {
    async runBatch2Migration(onProgress?: (message: string) => void): Promise<Batch2MigrationSummary> {
        onProgress?.('Checking Firestore material data');
        const materials = await safeCount(() => getAllMaterials());

        onProgress?.('Checking Firestore accommodation data');
        const accommodations = await safeCount(() => accommodationService.listAllAccommodations());
        const accommodationAssignments = await safeCount(() => accommodationAssignmentService.getAllAssignments());
        const utilityRecords = await safeCount(() => accommodationService.listAllUtilityRecords());

        onProgress?.('Checking Firestore vehicle data');
        const vehicles = await safeCount(() => vehicleService.getVehicles());
        const vehicleAssignments = await safeCount(() => vehicleService.listAllVehicleAssignments());
        const vehicleExpenses = await safeCount(() => vehicleService.listAllVehicleExpenses());

        onProgress?.('Batch 2 collections already use Firestore');

        return {
            mode: 'firestore-only',
            skippedLegacyRead: true,
            collections: {
                materials,
                accommodations,
                accommodationAssignments,
                utilityRecords,
                vehicles,
                vehicleAssignments,
                vehicleExpenses
            },
            message: 'Batch 2 collections already run on Firestore. No legacy migration was required.'
        };
    }
};

export const runBatch2Migration = coreMigrationService.runBatch2Migration.bind(coreMigrationService);
