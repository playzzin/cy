
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = './service-account.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));

console.log(`🔑 Service Account Project ID: ${serviceAccount.project_id}`);

const app = initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore(app);

const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync('diagnose_result.txt', msg + '\n');
};

const diagnose = async () => {
    try {
        fs.writeFileSync('diagnose_result.txt', ''); // Clear file
        log(`🔑 Service Account Project ID: ${serviceAccount.project_id}`);
        log("🔍 Listing Collections...");
        const collections = await db.listCollections();

        if (collections.length === 0) {
            log("⚠️ No collections found. Is the database empty?");
        } else {
            for (const col of collections) {
                const snapshot = await col.limit(1).get();
                log(`- Collection: ${col.id} (Has docs: ${!snapshot.empty})`);
            }
        }
    } catch (e: any) {
        log(`❌ Error accessing Firestore: ${e.message}`);
    }
};

diagnose();
