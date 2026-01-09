
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDataConnect } from 'firebase-admin/data-connect';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { connectorConfig, createCompany, Status } from '../src/dataconnect-admin-generated/index.cjs.js';

const SERVICE_ACCOUNT_PATH = './service-account.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found at:', path.resolve(SERVICE_ACCOUNT_PATH));
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));

// Initialize Firebase Admin
const app = initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore(app);
const dc = getDataConnect(connectorConfig); // Admin SDK connection

console.log("🚀 Starting Company Migration...");

const migrateCompanies = async () => {
    try {
        const collections = ['companies_main', 'companies_client', 'companies_partner'];
        let successCount = 0;
        let errorCount = 0;
        const idMap: Record<string, string> = {};

        for (const colName of collections) {
            console.log(`\n📂 Reading Collection: ${colName}...`);
            const snapshot = await db.collection(colName).get();
            console.log(`📊 Found ${snapshot.size} companies in ${colName}.`);

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const companyId = doc.id;

                // console.log(`Processing ${data.name} (${companyId})...`);

                try {
                    // Map Status
                    let status = Status.ACTIVE;
                    if (data.status === 'inactive') status = Status.INACTIVE;
                    if (data.status === 'archived') status = Status.ARCHIVED;

                    // Infer type from collection if missing
                    let type = data.type;
                    if (!type) {
                        if (colName === 'companies_client') type = '건설사'; // Or 'Client'
                        else if (colName === 'companies_partner') type = '협력사'; // Or 'Partner'
                        else type = '미지정';
                    }

                    const res = await createCompany(dc, {
                        name: data.name || 'Unknown',
                        code: data.code || 'UNKNOWN',
                        businessNumber: data.businessNumber || null,
                        ceoName: data.ceoName || null,
                        type: type,
                        status: status
                    });
                    idMap[companyId] = res.data.company_insert.id;
                    // console.log(`✅ Migrated: ${data.name}`);
                    process.stdout.write('.'); // Minimal output
                    successCount++;
                } catch (err: any) {
                    console.error(`\n❌ Failed to migrate ${data.name} (${companyId}):`, err.message);
                    errorCount++;
                }
            }
        }

        console.log(`\n\n🎉 Migration Complete!`);
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`🧾 ID Map entries: ${Object.keys(idMap).length}`);

    } catch (error) {
        console.error("🔥 Fatal Error during migration:", error);
    }
};

migrateCompanies();
