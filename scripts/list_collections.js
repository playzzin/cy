const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listCollections() {
    try {
        const collections = await db.listCollections();
        const names = collections.map(c => c.id).sort();
        fs.writeFileSync(path.join(__dirname, 'firestore_collections.txt'), names.join('\n'));
        console.log('Saved to firestore_collections.txt');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listCollections();
