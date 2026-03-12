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

// 삭제할 컬렉션 목록 (legacy backend로 이전 완료된 데이터)
const collectionsToDelete = [
    'accommodations',
    'accommodation_list',
    'accommodation_assignments',
    'accommodationAssignments',
    'utility_records',
    'utilityRecords'
];

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(100);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, collectionPath, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, collectionPath, resolve) {
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

    console.log(`[${collectionPath}] Deleted batch of ${batchSize} documents.`);
    // 재귀적으로 다음 배치 처리
    process.nextTick(() => {
        deleteQueryBatch(db, query, collectionPath, resolve);
    });
}

async function run() {
    for (const collection of collectionsToDelete) {
        console.log(`Starting deletion of collection: ${collection}...`);
        await deleteCollection(collection);
        console.log(`Successfully deleted collection: ${collection}`);
    }
}

run()
    .then(() => {
        console.log('All specified collections deleted successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error during deletion:', err);
        process.exit(1);
    });
