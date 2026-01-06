import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// 주의: 이 스크립트를 실행하려면 Service Account Key가 필요합니다.
// 1. Firebase Console > Project Settings > Service accounts 에서 비공개 키 생성
// 2. 다운로드 받은 JSON 파일을 'service-account.json' 이름으로 프로젝트 루트에 저장
// 3. .gitignore에 'service-account.json' 및 'backups/' 추가
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const SERVICE_ACCOUNT_PATH = './service-account.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found!');
    console.error(`Pleae save it to: ${path.resolve(SERVICE_ACCOUNT_PATH)}`);
    process.exit(1);
}

const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const COLLECTIONS_TO_BACKUP = [
    'users',
    'workers',
    'teams',
    'sites',
    'companies',
    'daily_reports',
    'positions',
    'menus',
    'system_logs'
];

const BACKUP_DIR = path.join(__dirname, '../backups', new Date().toISOString().replace(/[:.]/g, '-'));

const backupCollection = async (collectionName: string) => {
    console.log(`📦 Backing up ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    const filePath = path.join(BACKUP_DIR, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.length} documents to ${filePath}`);
    return data.length;
};

const runBackup = async () => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        console.log(`🚀 Starting backup to: ${BACKUP_DIR}`);

        let totalDocs = 0;
        for (const col of COLLECTIONS_TO_BACKUP) {
            totalDocs += await backupCollection(col);
        }

        console.log(`\n🎉 Backup completed successfully! Total documents: ${totalDocs}`);
        console.log(`📁 Location: ${BACKUP_DIR}`);

    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
};

runBackup();
