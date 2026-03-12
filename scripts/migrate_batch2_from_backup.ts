import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

/**
 * migrate_batch2_from_backup.ts
 * 
 * 로컬 백업 JSON 파일로부터 자재, 숙소, 차량 데이터를 읽어 Firestore로 직접 이관합니다.
 * 이 작업은 legacy cloud backup에 데이터가 유실되었을 때 로컬 백업을 복원하기 위한 용도입니다.
 */

const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'service-account.json');
const BACKUP_BASE_DIR = 'c:/Users/playz/cy/backups/2026-01-08T19-39-12-927Z';

const COLLECTIONS = {
    materials: 'materials',
    accommodations: 'accommodations',
    vehicles: 'vehicles'
};

const FILES = {
    materials: 'materials.json',
    accommodations: 'accommodations.json',
    vehicles: 'vehicles.json'
};

// --- INITIALIZATION ---
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found at:', SERVICE_ACCOUNT_PATH);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/**
 * Firestore Timestamp 변환 헬퍼
 */
function toFirestoreTimestamp(value: any): Timestamp | any {
    if (!value) return null;
    if (value._seconds !== undefined) {
        return new Timestamp(value._seconds, value._nanoseconds || 0);
    }
    if (typeof value === 'string' || value instanceof Date) {
        return Timestamp.fromDate(new Date(value));
    }
    return value;
}

/**
 * 데이터 재가공 (Timestamp 처리 등)
 */
function processData(data: any): any {
    const processed = { ...data };
    if (processed.createdAt) processed.createdAt = toFirestoreTimestamp(processed.createdAt);
    if (processed.updatedAt) processed.updatedAt = toFirestoreTimestamp(processed.updatedAt);

    // 숙소(accommodations) 관련 필드 재귀 처리 (필요시 추가)
    if (processed.contract) {
        if (processed.contract.startDate) processed.contract.startDate = processed.contract.startDate; // String 유지 (YYYY-MM-DD)
        if (processed.contract.endDate) processed.contract.endDate = processed.contract.endDate;
    }

    return processed;
}

/**
 * 이관 메인 로직
 */
async function migrate() {
    console.log('🚀 Batch 2 Data Migration (from local backup) started...');

    for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
        const filePath = path.join(BACKUP_BASE_DIR, FILES[key as keyof typeof FILES]);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ File not found: ${filePath}. Skipping ${key}...`);
            continue;
        }

        console.log(`\n📦 Migrating [${key}] from ${filePath}...`);
        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!Array.isArray(rawData)) {
            console.error(`❌ Data in ${FILES[key as keyof typeof FILES]} is not an array.`);
            continue;
        }

        const batch = db.batch();
        let count = 0;

        for (const item of rawData) {
            if (!item.id) {
                console.warn(`⚠️ Item missing ID in ${key}, skipping:`, item);
                continue;
            }

            const docRef = db.collection(collectionName).doc(item.id);
            const dataToUpload = processData(item);

            // @ts-ignore
            batch.set(docRef, dataToUpload, { merge: true });
            count++;

            // Firestore Batch limit is 500
            if (count % 500 === 0) {
                await batch.commit();
                console.log(`   - ${count} items committed...`);
            }
        }

        if (count % 500 !== 0) {
            await batch.commit();
        }

        console.log(`✅ [${key}] Migration complete: ${count} documents uploaded to [${collectionName}].`);
    }

    console.log('\n✨ All Batch 2 data restored successfully!');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
