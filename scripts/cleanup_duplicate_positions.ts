import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
import { getDataConnect } from 'firebase-admin/data-connect';
// @ts-ignore
import {
    connectorConfig,
    listPositions,
    deletePosition
} from '../src/dataconnect-admin-generated/index.cjs.js';

const SERVICE_ACCOUNT_PATH = './service-account.json';
const BACKUPS_DIR = './backups';

const argValue = (name: string): string | null => {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return null;
    const value = process.argv[idx + 1];
    return value ? String(value) : null;
};

const hasFlag = (name: string) => process.argv.includes(name);

const getLatestBackupDir = (): string | null => {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const dirs = fs
        .readdirSync(BACKUPS_DIR)
        .filter((f) => fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
        .sort()
        .reverse();
    return dirs.length > 0 ? path.join(BACKUPS_DIR, dirs[0]) : null;
};

const loadJson = (dir: string, filename: string): any[] => {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any[];
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

type PositionRow = {
    id: string;
    legacyId: string | null;
    name: string;
    createdAt: string;
};

const run = async () => {
    const execute = hasFlag('--execute');

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ Service Account Key file not found!');
        process.exit(1);
    }

    const requestedBackup = argValue('--backup');
    const backupDir = requestedBackup ? path.resolve(requestedBackup) : getLatestBackupDir();
    if (!backupDir || !fs.existsSync(backupDir)) {
        console.error('❌ Backup directory not found.');
        process.exit(1);
    }

    const backupPositions = loadJson(backupDir, 'positions.json');
    const backupLegacyIds = new Set<string>();
    for (const p of backupPositions) {
        if (p?.id) backupLegacyIds.add(String(p.id));
    }

    if (backupLegacyIds.size === 0) {
        console.log('ℹ️ No positions found in backup. Nothing to cleanup.');
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });

    const dc = getDataConnect(connectorConfig);

    const res = await listPositions(dc);
    const dcPositions: PositionRow[] = ((res as any)?.data?.positions ?? []).map((p: any) => ({
        id: String(p.id),
        legacyId: p?.legacyId != null ? String(p.legacyId) : null,
        name: String(p.name),
        createdAt: String(p.createdAt)
    }));

    const byLegacyId = new Map<string, PositionRow[]>();
    const missingLegacyId: PositionRow[] = [];
    const extraLegacyId: PositionRow[] = [];

    for (const p of dcPositions) {
        if (!p.legacyId) {
            missingLegacyId.push(p);
            continue;
        }
        if (!backupLegacyIds.has(p.legacyId)) {
            extraLegacyId.push(p);
            continue;
        }
        const arr = byLegacyId.get(p.legacyId) ?? [];
        arr.push(p);
        byLegacyId.set(p.legacyId, arr);
    }

    const keepByLegacyId = new Map<string, PositionRow>();
    const deleteList: PositionRow[] = [];

    for (const legacyId of backupLegacyIds) {
        const rows = byLegacyId.get(legacyId) ?? [];
        if (rows.length === 0) continue;

        const sorted = [...rows].sort((a, b) => {
            const c = a.createdAt.localeCompare(b.createdAt);
            if (c !== 0) return c;
            return a.id.localeCompare(b.id);
        });

        const keep = sorted[0];
        keepByLegacyId.set(legacyId, keep);
        deleteList.push(...sorted.slice(1));
    }

    console.log('# Cleanup Plan (duplicate positions)');
    console.log(`- backup positions: ${backupLegacyIds.size}`);
    console.log(`- dataconnect positions: ${dcPositions.length}`);
    console.log(`- matched legacyId positions: ${Array.from(byLegacyId.values()).reduce((sum, a) => sum + a.length, 0)}`);
    console.log(`- positions with NULL legacyId: ${missingLegacyId.length} (will not be deleted)`);
    console.log(`- positions with legacyId not in backup: ${extraLegacyId.length} (will not be deleted)`);
    console.log(`- duplicates to delete (same legacyId): ${deleteList.length}`);

    if (deleteList.length > 0) {
        const preview = deleteList.slice(0, 20);
        console.log('\n## Delete preview (first 20)');
        for (const p of preview) {
            console.log(`- id=${p.id} legacyId=${p.legacyId} name=${p.name} createdAt=${p.createdAt}`);
        }
        if (deleteList.length > preview.length) {
            console.log(`- ... and ${deleteList.length - preview.length} more`);
        }
    }

    if (!execute) {
        console.log('\nℹ️ Dry-run only. Re-run with --execute to perform deletions.');
        return;
    }

    console.log('\n--- Deleting duplicate Position rows ---');
    for (const p of deleteList) {
        try {
            await deletePosition(dc, { id: p.id });
            console.log(`✅ deleted position id=${p.id} legacyId=${p.legacyId}`);
        } catch (e) {
            console.error(`❌ failed to delete position id=${p.id} legacyId=${p.legacyId}`, e);
        }
    }

    console.log('\n🎉 Cleanup complete.');
};

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
