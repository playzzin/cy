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

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const argValue = (name: string): string | null => {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return null;
    const value = process.argv[idx + 1];
    return value ? String(value) : null;
};

const hasFlag = (name: string) => process.argv.includes(name);

const readUsageReportCollections = (reportPath: string): string[] => {
    try {
        if (!fs.existsSync(reportPath)) return [];
        const raw = fs.readFileSync(reportPath, 'utf8');
        const json = JSON.parse(raw) as any;
        const cols = Array.isArray(json?.collections) ? json.collections : [];
        const names: string[] = cols
            .map((c: any) => c?.name)
            .filter((n: any): n is string => typeof n === 'string' && n.trim().length > 0);
        return Array.from(new Set<string>(names.map((n) => n.trim())));
    } catch {
        return [];
    }
};

const COLLECTIONS_TO_BACKUP = [
    'users',
    'workers',
    'teams',
    'sites',
    'companies_main',
    'companies_client',
    'companies_partner',
    'daily_reports',
    'positions',
    'menus',
    'system_logs'
];

const usageReportPath = argValue('--usage-report') ?? path.join(process.cwd(), 'firestore_usage_report.json');
const includeUsageReport = hasFlag('--from-usage-report');
const usageReportCollections = includeUsageReport ? readUsageReportCollections(usageReportPath) : [];
const excluded = new Set<string>(['companies']);
const ALL_COLLECTIONS_TO_BACKUP = [...new Set([
    ...COLLECTIONS_TO_BACKUP,
    ...usageReportCollections.filter((c) => !excluded.has(c))
])].sort((a, b) => a.localeCompare(b));

const BACKUP_DIR = path.join(process.cwd(), 'backups', new Date().toISOString().replace(/[:.]/g, '-'));

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

        if (includeUsageReport) {
            console.log(`ℹ️ Including collections from usage report: ${path.relative(process.cwd(), usageReportPath)}`);
            console.log(`ℹ️ Total collections to backup: ${ALL_COLLECTIONS_TO_BACKUP.length}`);
        }

        let totalDocs = 0;
        const companyParts: any[] = [];
        const backedUpCollections = new Set<string>();
        for (const col of ALL_COLLECTIONS_TO_BACKUP) {
            totalDocs += await backupCollection(col);
            backedUpCollections.add(col);

            if (col === 'companies_main' || col === 'companies_client' || col === 'companies_partner') {
                const partPath = path.join(BACKUP_DIR, `${col}.json`);
                try {
                    const part = JSON.parse(fs.readFileSync(partPath, 'utf8')) as any[];
                    part.forEach((c) => {
                        if (col === 'companies_client' && !c.type) c.type = '건설사';
                        if (col === 'companies_partner' && !c.type) c.type = '협력사';
                        if (col === 'companies_main' && !c.type) c.type = '미지정';
                        c._sourceCollection = col;
                    });
                    companyParts.push(...part);
                } catch {
                    // ignore
                }
            }
        }

        // Create merged companies.json for migrate_to_postgres.ts compatibility
        const seen = new Set<string>();
        const mergedCompanies = companyParts.filter((c) => {
            const id = String(c?.id ?? '');
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        const mergedCompaniesFilename = backedUpCollections.has('companies') ? 'companies_merged.json' : 'companies.json';
        const mergedCompaniesPath = path.join(BACKUP_DIR, mergedCompaniesFilename);
        fs.writeFileSync(mergedCompaniesPath, JSON.stringify(mergedCompanies, null, 2));
        console.log(`✅ Saved ${mergedCompanies.length} merged companies to ${mergedCompaniesPath}`);

        console.log(`\n🎉 Backup completed successfully! Total documents: ${totalDocs}`);
        console.log(`📁 Location: ${BACKUP_DIR}`);

    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
};

runBackup();
