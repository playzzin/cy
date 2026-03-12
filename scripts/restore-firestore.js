/**
 * Firestore 백업 복원 스크립트
 * backups/2026-01-08T19-39-12-927Z/ 폴더의 JSON 파일을 Firestore에 업로드
 * 
 * 사용법: node scripts/restore-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Service Account 키 로드
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const BACKUP_DIR = path.join(__dirname, '../backups/2026-01-08T19-39-12-927Z');

// 복원할 컬렉션 목록 (파일명 → Firestore 컬렉션명)
const COLLECTIONS_TO_RESTORE = [
    { file: 'workers.json', collection: 'workers' },
    { file: 'teams.json', collection: 'teams' },
    { file: 'sites.json', collection: 'sites' },
    { file: 'companies.json', collection: 'companies' },
    { file: 'companies_main.json', collection: 'companies_main' },
    { file: 'companies_client.json', collection: 'companies_client' },
    { file: 'companies_partner.json', collection: 'companies_partner' },
    { file: 'daily_reports.json', collection: 'daily_reports' },
    { file: 'dailyReports.json', collection: 'dailyReports' },
    { file: 'positions.json', collection: 'positions' },
    { file: 'menus.json', collection: 'menus' },
    { file: 'users.json', collection: 'users' },
    { file: 'settlements.json', collection: 'settlements' },
];

// Firestore는 _seconds/_nanoseconds 형태의 timestamp를 변환 필요
function convertTimestamps(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(convertTimestamps);

    // {_seconds, _nanoseconds} → Firestore Timestamp
    if ('_seconds' in obj && '_nanoseconds' in obj) {
        return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds);
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = convertTimestamps(value);
    }
    return result;
}

async function restoreCollection(fileName, collectionName) {
    const filePath = path.join(BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`  ⏭️  건너뜀 (파일 없음): ${fileName}`);
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const docs = JSON.parse(raw);

    if (!Array.isArray(docs) || docs.length === 0) {
        console.log(`  ⚠️  빈 파일: ${fileName}`);
        return;
    }

    console.log(`\n📦 복원 중: ${collectionName} (${docs.length}건)`);

    // Firestore batch write (최대 500건씩)
    const BATCH_SIZE = 400;
    let total = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);

        for (const doc of chunk) {
            const { id, ...data } = doc;
            if (!id) continue;

            const ref = db.collection(collectionName).doc(id);
            const convertedData = convertTimestamps(data);
            batch.set(ref, convertedData, { merge: false });
        }

        await batch.commit();
        total += chunk.length;
        process.stdout.write(`  ✅ ${total}/${docs.length} 완료\r`);
    }

    console.log(`  ✅ ${collectionName}: ${total}건 복원 완료`);
}

async function main() {
    console.log('🔥 Firestore 데이터 복원 시작');
    console.log(`📁 백업 폴더: ${BACKUP_DIR}`);
    console.log('-------------------------------------------');

    const startTime = Date.now();

    for (const { file, collection } of COLLECTIONS_TO_RESTORE) {
        try {
            await restoreCollection(file, collection);
        } catch (err) {
            console.error(`  ❌ ${collection} 복원 실패:`, err.message);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n-------------------------------------------');
    console.log(`✅ 복원 완료! (소요시간: ${elapsed}초)`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
});
