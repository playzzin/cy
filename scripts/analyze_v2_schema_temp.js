const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function analyzeCollection(collectionName) {
    console.log(`\n\n=== Analyzing Collection: ${collectionName} ===`);
    try {
        const snapshot = await db.collection(collectionName).limit(3).get();
        if (snapshot.empty) {
            console.log('  -> Collection is empty.');
            return;
        }

        snapshot.forEach(doc => {
            console.log(`\nDocument ID: ${doc.id}`);
            const data = doc.data();
            for (const key of Object.keys(data)) {
                let val = data[key];
                let type = typeof val;
                if (val === null) type = 'null';
                else if (Array.isArray(val)) type = `array (length: ${val.length})`;
                else if (val instanceof admin.firestore.Timestamp) type = 'timestamp';
                else if (val instanceof admin.firestore.DocumentReference) type = 'reference';
                else if (type === 'object') type = `object (keys: ${Object.keys(val).join(', ')})`;

                const preview = String(val).substring(0, 50).replace(/\n/g, ' ');
                console.log(`  - ${key}: [${type}] ${type !== 'object' && type !== 'timestamp' ? preview : ''}`);
            }
        });
    } catch (e) {
        console.error(`Error analyzing ${collectionName}:`, e);
    }
}

async function run() {
    const v2Collections = [
        'accommodations_v2',
        'accommodation_assignments_v2',
        'accommodation_contracts_v2',
        'accommodation_utility_policy_v2',
        'accommodation_billing_targets',
        'accommodation_landlord_payment_v2'
    ];

    for (const col of v2Collections) {
        await analyzeCollection(col);
    }
    process.exit(0);
}

run();
