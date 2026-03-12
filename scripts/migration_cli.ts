
import { coreMigrationService } from '../src/services/coreMigrationService';

async function run() {
    console.log('--- Batch 2 CLI Migration Start ---');
    try {
        const result = await coreMigrationService.runBatch2Migration((msg) => {
            console.log(`[STATUS] ${msg}`);
        });
        console.log('--- Migration Completed Successfully ---');
        console.log('Summary:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('--- Migration Failed ---');
        console.error(error);
        process.exit(1);
    }
}

run();
