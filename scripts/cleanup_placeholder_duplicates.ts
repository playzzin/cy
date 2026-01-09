import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
import { getDataConnect } from 'firebase-admin/data-connect';
// @ts-ignore
import {
    connectorConfig,
    listTeams,
    listWorkers,
    listDailyReportWorkers,
    deleteDailyReportWorker,
    deleteWorker
} from '../src/dataconnect-admin-generated/index.cjs.js';

const SERVICE_ACCOUNT_PATH = './service-account.json';
const BACKUPS_DIR = './backups';

const PLACEHOLDER_WORKER_LEGACY_PREFIX = '__placeholder_worker__:';
const placeholderWorkerLegacyId = (name: string) => `${PLACEHOLDER_WORKER_LEGACY_PREFIX}${encodeURIComponent(name)}`;

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

type WorkerRow = {
    id: string;
    legacyId?: string | null;
    name: string;
    createdAt?: string | null;
};

type DailyReportWorkerRow = {
    dailyReport: { id: string };
    worker: { id: string; name: string; legacyId?: string | null };
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

    const dailyReports = loadJson(backupDir, 'daily_reports.json');

    const unknownWorkerNames = new Set<string>();
    for (const r of dailyReports) {
        const rows = Array.isArray((r as any)?.workers) ? (r as any).workers : [];
        for (const row of rows) {
            const legacyWorkerId = row?.workerId ? String(row.workerId) : null;
            const isUnknown = !legacyWorkerId || legacyWorkerId === 'unknown';
            if (!isUnknown) continue;
            const name = row?.name ? String(row.name) : null;
            if (name) unknownWorkerNames.add(name);
        }
    }

    if (unknownWorkerNames.size === 0) {
        console.log('ℹ️ No unknown workerId rows found in backup. Nothing to cleanup.');
        return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    const dc = getDataConnect(connectorConfig);

    const teamsRes = await listTeams(dc);
    const workersRes = await listWorkers(dc);
    const drwRes = await listDailyReportWorkers(dc);

    const teams: Array<{ id: string; leaderId: string | null }> = ((teamsRes as any)?.data?.teams ?? []).map((t: any) => ({
        id: String(t.id),
        leaderId: t?.leader?.id ? String(t.leader.id) : null
    }));

    const workers: WorkerRow[] = ((workersRes as any)?.data?.workers ?? []).map((w: any) => ({
        id: String(w.id),
        legacyId: w.legacyId ?? null,
        name: String(w.name),
        createdAt: w.createdAt ?? null
    }));

    const drws: DailyReportWorkerRow[] = ((drwRes as any)?.data?.dailyReportWorkers ?? []).map((rw: any) => ({
        dailyReport: { id: String(rw.dailyReport?.id) },
        worker: {
            id: String(rw.worker?.id),
            name: String(rw.worker?.name),
            legacyId: rw.worker?.legacyId ?? null
        }
    }));

    const candidatesByName = new Map<string, WorkerRow[]>();
    for (const w of workers) {
        if (!unknownWorkerNames.has(w.name)) continue;
        const legacy = w.legacyId;
        const isCandidate = !legacy || String(legacy).startsWith(PLACEHOLDER_WORKER_LEGACY_PREFIX);
        if (!isCandidate) continue;
        const arr = candidatesByName.get(w.name) ?? [];
        arr.push(w);
        candidatesByName.set(w.name, arr);
    }

    const canonicalByName = new Map<string, WorkerRow>();
    const duplicatesByName = new Map<string, WorkerRow[]>();

    for (const name of unknownWorkerNames) {
        const cands = candidatesByName.get(name) ?? [];
        if (cands.length <= 1) continue;

        const preferredLegacy = placeholderWorkerLegacyId(name);
        const preferred = cands.find((c) => c.legacyId === preferredLegacy);

        const sorted = [...cands].sort((a, b) => {
            const aCreated = a.createdAt ?? '';
            const bCreated = b.createdAt ?? '';
            if (aCreated && bCreated) return aCreated.localeCompare(bCreated);
            if (aCreated) return -1;
            if (bCreated) return 1;
            return a.id.localeCompare(b.id);
        });

        const canonical = preferred ?? sorted[0];
        canonicalByName.set(name, canonical);

        const dups = cands.filter((c) => c.id !== canonical.id);
        duplicatesByName.set(name, dups);
    }

    const duplicateWorkerIds = new Set<string>();
    for (const [, dups] of duplicatesByName) {
        for (const w of dups) duplicateWorkerIds.add(w.id);
    }

    const referencedByTeamLeader = new Set<string>();
    for (const t of teams) {
        if (t.leaderId && duplicateWorkerIds.has(t.leaderId)) {
            referencedByTeamLeader.add(t.leaderId);
        }
    }

    if (referencedByTeamLeader.size > 0) {
        console.log(`\n⚠️ Some duplicate placeholder workers are referenced as Team leaders. They will be skipped:`);
        for (const id of referencedByTeamLeader) {
            console.log(`- ${id}`);
            duplicateWorkerIds.delete(id);
        }
    }

    const drwToDelete: Array<{ dailyReportId: string; workerId: string; workerName: string }> = [];
    for (const rw of drws) {
        if (!rw?.dailyReport?.id || !rw?.worker?.id) continue;
        if (!duplicateWorkerIds.has(rw.worker.id)) continue;
        drwToDelete.push({ dailyReportId: rw.dailyReport.id, workerId: rw.worker.id, workerName: rw.worker.name });
    }

    console.log('# Cleanup Plan (placeholder duplicates)');
    for (const [name, canonical] of canonicalByName) {
        const dups = duplicatesByName.get(name) ?? [];
        console.log(`- ${name}: canonical=${canonical.id} legacyId=${canonical.legacyId ?? 'NULL'} duplicates=${dups.length}`);
    }
    console.log(`- duplicate workers to delete: ${duplicateWorkerIds.size}`);
    console.log(`- daily_report_workers to delete: ${drwToDelete.length}`);

    if (!execute) {
        console.log('\nℹ️ Dry-run only. Re-run with --execute to perform deletions.');
        return;
    }

    console.log('\n--- Deleting DailyReportWorker rows ---');
    for (const item of drwToDelete) {
        try {
            await deleteDailyReportWorker(dc, { dailyReportId: item.dailyReportId, workerId: item.workerId });
            console.log(`✅ deleted dailyReportWorker (report=${item.dailyReportId}, worker=${item.workerId}, name=${item.workerName})`);
        } catch (e) {
            console.error(`❌ failed to delete dailyReportWorker (report=${item.dailyReportId}, worker=${item.workerId})`, e);
        }
    }

    console.log('\n--- Deleting duplicate Worker rows ---');
    for (const workerId of duplicateWorkerIds) {
        try {
            await deleteWorker(dc, { id: workerId });
            console.log(`✅ deleted worker ${workerId}`);
        } catch (e) {
            console.error(`❌ failed to delete worker ${workerId}`, e);
        }
    }

    console.log('\n🎉 Cleanup complete.');
};

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
