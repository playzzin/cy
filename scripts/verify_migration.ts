
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'service-account.json'), 'utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'cyee-9c1e4'
});

const db = admin.firestore();

async function verify() {
    const collections = [
        'materials',
        'materialInbounds',
        'materialOutbounds',
        'accommodations',
        'accommodationUtilityRecords',
        'accommodationAssignments',
        'vehicles',
        'vehicleAssignments',
        'vehicleExpenses'
    ];

    console.log('--- Migration Verification ---');
    for (const col of collections) {
        const snapshot = await db.collection(col).limit(1).get();
        const count = (await db.collection(col).count().get()).data().count;
        console.log(`${col}: ${count} documents`);
        if (count > 0) {
            console.log(`  Sample ID: ${snapshot.docs[0].id}`);
        }
    }
}

verify().then(() => process.exit(0));
