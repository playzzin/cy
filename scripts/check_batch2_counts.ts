import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkCounts() {
    const collections = ['materials', 'accommodations', 'vehicles'];
    for (const coll of collections) {
        const snap = await db.collection(coll).count().get();
        console.log(`Collection: ${coll} - Count: ${snap.data().count}`);
    }
}

checkCounts();
