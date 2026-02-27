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
    const output = { collectionName, documents: [] };
    try {
        const snapshot = await db.collection(collectionName).limit(3).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const parsedData = {};
            for (const key of Object.keys(data)) {
                let val = data[key];
                let type = typeof val;
                if (val === null) type = 'null';
                else if (Array.isArray(val)) type = `array (length: ${val.length})`;
                else if (val instanceof admin.firestore.Timestamp) type = 'timestamp';
                else if (val instanceof admin.firestore.DocumentReference) type = 'reference';
                else if (type === 'object') type = `object (keys: ${Object.keys(val).join(', ')})`;

                parsedData[key] = { type, preview: String(val).substring(0, 100) };
            }
            output.documents.push({ id: doc.id, schema: parsedData });
        });
    } catch (e) {
        output.error = e.message;
    }
    return output;
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

    const results = [];
    for (const col of v2Collections) {
        results.push(await analyzeCollection(col));
    }
    fs.writeFileSync('v2_schema.json', JSON.stringify(results, null, 2), 'utf8');
    process.exit(0);
}

run();
