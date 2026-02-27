const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 서비스 계정 키 경로
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account file not found:', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Firebase Admin 초기화
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const collectionPath = 'daily_reports';

async function deleteCollection(path) {
    const collectionRef = db.collection(path);
    const query = collectionRef.limit(100);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Deleted batch of ${batchSize} documents.`);
    // 재귀적으로 다음 배치 처리
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

console.log(`Starting deletion of collection: ${collectionPath}...`);
deleteCollection(collectionPath)
    .then(() => {
        console.log(`Successfully deleted collection: ${collectionPath}`);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error deleting collection:', err);
        process.exit(1);
    });
