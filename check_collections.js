const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCollections() {
    const collections = await db.listCollections();
    console.log('--- Current Firestore Collections ---');
    collections.forEach(col => {
        console.log(col.id);
    });
    console.log('------------------------------------');
}

checkCollections().catch(console.error);
