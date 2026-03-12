import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// service-account.json load
const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "cyee-9c1e4"
    });
}

const db = admin.firestore();

async function checkAllFirestore() {
    console.log('--- Firestore Collections Analysis ---');
    try {
        const collections = await db.listCollections();
        console.log(`Found ${collections.length} collections.`);

        for (const col of collections) {
            const snapshot = await col.limit(10).get(); // Just a sample
            const totalCount = (await col.count().get()).data().count;
            console.log(`- Collection: ${col.id} | Total Documents: ${totalCount}`);

            if (totalCount > 0) {
                console.log(`  Sample IDs: ${snapshot.docs.map(d => d.id).join(', ')}`);
            }
        }
    } catch (err) {
        console.error('Error listing Firestore collections:', err);
    }
}

checkAllFirestore();
