
import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import {
    connectorConfig,
    createCompany,
    createTeam,
    updateTeam,
    createWorker,
    createSite,
    createDailyReport,
    createDailyReportWorker,
    updateDailyReport,
    createPosition,
    listCompanies,
    listTeams,
    listWorkers,
    listPositions,
    listSites,
    listDailyReports,
    Status
} from '../src/dataconnect-admin-generated/index.cjs.js';
import { getDataConnect } from 'firebase-admin/data-connect';

const toDateString = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const isoLike = s.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) return isoLike;
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return null;
    }
    if (typeof value === 'number') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return null;
    }
    if (typeof value === 'object') {
        const anyVal = value as any;
        const seconds = anyVal?._seconds ?? anyVal?.seconds;
        const nanoseconds = anyVal?._nanoseconds ?? anyVal?.nanoseconds ?? 0;
        if (typeof seconds === 'number') {
            const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
            const d = new Date(ms);
            if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
    }
    return null;
};

const toTimestampString = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
        return null;
    }
    if (typeof value === 'number') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
        return null;
    }
    if (typeof value === 'object') {
        const anyVal = value as any;
        const seconds = anyVal?._seconds ?? anyVal?.seconds;
        const nanoseconds = anyVal?._nanoseconds ?? anyVal?.nanoseconds ?? 0;
        if (typeof seconds === 'number') {
            const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
            const d = new Date(ms);
            if (!Number.isNaN(d.getTime())) return d.toISOString();
        }
    }
    return null;
};

const toInt = (value: unknown, fallback: number): number => {
    const num = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
    if (!Number.isFinite(num)) return fallback;
    return Math.trunc(num);
};

const toFloat = (value: unknown, fallback: number): number => {
    const num = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
    if (!Number.isFinite(num)) return fallback;
    return num;
};

const POSITIONS_ONLY = process.argv.includes('--positions-only');
const ONLY_NON_INT_POSITIONS = process.argv.includes('--only-non-int-positions');
const SKIP_POSITIONS = process.argv.includes('--skip-positions');
const SKIP_DAILY_REPORTS = process.argv.includes('--skip-daily-reports');
const ONLY_NEW_COLLECTIONS = process.argv.includes('--only-new-collections');
const argValue = (name: string): string | null => {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return null;
    const value = process.argv[idx + 1];
    return value ? String(value) : null;
};

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = './service-account.json';
const BACKUPS_DIR = './backups';

// ID Mapping: Firestore String ID -> Postgres UUID
const idMap: Record<string, string> = {};

const pairKey = (a: string, b: string) => `${a}::${b}`;

const PLACEHOLDER_WORKER_LEGACY_PREFIX = '__placeholder_worker__:';
const placeholderWorkerLegacyId = (name: string) => `${PLACEHOLDER_WORKER_LEGACY_PREFIX}${encodeURIComponent(name)}`;

// Helper to find latest backup
const getLatestBackupDir = (): string | null => {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const dirs = fs.readdirSync(BACKUPS_DIR)
        .filter(f => fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
        .sort().reverse();
    return dirs.length > 0 ? path.join(BACKUPS_DIR, dirs[0]) : null;
};

// Helper to load JSON
const loadJson = (dir: string, filename: string): any[] => {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Failed to read ${filename}:`, e);
        return [];
    }
};

// --- INITIALIZATION ---
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Service Account Key file not found!');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dataConnect = getDataConnect(connectorConfig);

// --- MIGRATION LOGIC ---
const migrate = async () => {
    const generatedModule: any = await import('../src/dataconnect-admin-generated/index.cjs.js');
    const generated: any = generatedModule?.default ?? generatedModule;

    const requestedBackup = argValue('--backup');
    const backupDir = requestedBackup ? path.resolve(requestedBackup) : getLatestBackupDir();
    if (!backupDir || !fs.existsSync(backupDir)) {
        console.error('❌ No backup directory found in ./backups');
        process.exit(1);
    }
    console.log(`📂 Loading data from: ${backupDir}`);

    const companies = loadJson(backupDir, 'companies.json');
    const teams = loadJson(backupDir, 'teams.json');
    const workers = loadJson(backupDir, 'workers.json');
    const sites = loadJson(backupDir, 'sites.json'); // Assuming keys or similar collection
    const dailyReports = loadJson(backupDir, 'daily_reports.json');
    const positions = loadJson(backupDir, 'positions.json');
    const users = loadJson(backupDir, 'users.json');
    const menus = loadJson(backupDir, 'menus.json');
    const systemLogs = loadJson(backupDir, 'system_logs.json');

    const auditLogs = loadJson(backupDir, 'audit_logs.json');
    const agents = loadJson(backupDir, 'agents.json');
    const agentConversations = loadJson(backupDir, 'agent_conversations.json');
    const settings = loadJson(backupDir, 'settings.json');
    const systemConfig = loadJson(backupDir, 'system_config.json');

    console.log(`📊 Found: ${companies.length} companies, ${teams.length} teams, ${workers.length} workers, ${sites.length} sites, ${dailyReports.length} reports`);

    const existingDailyReportWorkerPairs = new Set<string>();
    const placeholderWorkerByName: Record<string, string> = {};
    const placeholderWorkerCreatedAtByName: Record<string, string> = {};
    const existingAppUserIds = new Set<string>();
    const existingMenuConfigIds = new Set<string>();
    const existingPositionLegacyIds = new Set<string>();

    const existingAuditLogIds = new Set<string>();
    const existingAgentIds = new Set<string>();
    const existingAgentConversationIds = new Set<string>();
    const existingSettingIds = new Set<string>();
    const existingSystemConfigIds = new Set<string>();

    const unknownWorkerNames = new Set<string>();
    for (const r of dailyReports) {
        const rows = Array.isArray((r as any)?.workers) ? (r as any).workers : [];
        for (const row of rows) {
            const legacyWorkerId = row?.workerId ? String(row.workerId) : null;
            const isUnknown = !legacyWorkerId || legacyWorkerId === 'unknown';
            if (!isUnknown) continue;
            const workerName = row?.name ? String(row.name) : null;
            if (workerName) unknownWorkerNames.add(workerName);
        }
    }

    if (!POSITIONS_ONLY) {
        try {
            if (!ONLY_NEW_COLLECTIONS) {
                const [cRes, tRes, wRes, sRes, rRes] = await Promise.all([
                    listCompanies(dataConnect),
                    listTeams(dataConnect),
                    listWorkers(dataConnect),
                    listSites(dataConnect),
                    listDailyReports(dataConnect)
                ]);

                const existingCompanies = (cRes as any)?.data?.companies ?? [];
                const existingTeams = (tRes as any)?.data?.teams ?? [];
                const existingWorkers = (wRes as any)?.data?.workers ?? [];
                const existingSites = (sRes as any)?.data?.sites ?? [];
                const existingReports = (rRes as any)?.data?.dailyReports ?? [];
                existingCompanies.forEach((c: any) => {
                    const legacy = c?.legacyId;
                    if (legacy && c?.id) idMap[String(legacy)] = String(c.id);
                });
                existingTeams.forEach((t: any) => {
                    const legacy = t?.legacyId;
                    if (legacy && t?.id) idMap[String(legacy)] = String(t.id);
                });
                existingWorkers.forEach((w: any) => {
                    const legacy = w?.legacyId;
                    const name = w?.name;
                    const createdAt = w?.createdAt;
                    if (legacy && w?.id) idMap[String(legacy)] = String(w.id);

                    if (name && w?.id) {
                        const nameStr = String(name);
                        const legacyStr = legacy ? String(legacy) : '';

                        if (legacyStr.startsWith(PLACEHOLDER_WORKER_LEGACY_PREFIX)) {
                            const encoded = legacyStr.slice(PLACEHOLDER_WORKER_LEGACY_PREFIX.length);
                            const decodedName = decodeURIComponent(encoded);
                            const existingCreatedAt = placeholderWorkerCreatedAtByName[decodedName];
                            if (!placeholderWorkerByName[decodedName] || (createdAt && (!existingCreatedAt || String(createdAt) < existingCreatedAt))) {
                                placeholderWorkerByName[decodedName] = String(w.id);
                                if (createdAt) placeholderWorkerCreatedAtByName[decodedName] = String(createdAt);
                                idMap[legacyStr] = String(w.id);
                            }
                        } else if (!legacy && unknownWorkerNames.has(nameStr)) {
                            const existingCreatedAt = placeholderWorkerCreatedAtByName[nameStr];
                            if (!placeholderWorkerByName[nameStr] || (createdAt && (!existingCreatedAt || String(createdAt) < existingCreatedAt))) {
                                placeholderWorkerByName[nameStr] = String(w.id);
                                if (createdAt) placeholderWorkerCreatedAtByName[nameStr] = String(createdAt);
                            }
                        }
                    }
                });
                existingSites.forEach((s: any) => {
                    const legacy = s?.legacyId;
                    if (legacy && s?.id) idMap[String(legacy)] = String(s.id);
                });
                existingReports.forEach((r: any) => {
                    const legacy = r?.legacyId;
                    if (legacy && r?.id) idMap[String(legacy)] = String(r.id);
                });

                if (typeof generated?.listDailyReportWorkers === 'function') {
                    const rwRes = await generated.listDailyReportWorkers(dataConnect);
                    const existingReportWorkers = (rwRes as any)?.data?.dailyReportWorkers ?? [];
                    existingReportWorkers.forEach((rw: any) => {
                        const reportId = rw?.dailyReport?.id;
                        const workerId = rw?.worker?.id;
                        if (reportId && workerId) existingDailyReportWorkerPairs.add(pairKey(String(reportId), String(workerId)));
                    });
                }

                if (typeof generated?.listAppUsers === 'function') {
                    const uRes = await generated.listAppUsers(dataConnect);
                    const existingUsers = (uRes as any)?.data?.appUsers ?? [];
                    existingUsers.forEach((u: any) => {
                        if (u?.id) existingAppUserIds.add(String(u.id));
                    });
                }

                if (typeof generated?.listMenuConfigs === 'function') {
                    const mRes = await generated.listMenuConfigs(dataConnect);
                    const existingMenus = (mRes as any)?.data?.menuConfigs ?? [];
                    existingMenus.forEach((m: any) => {
                        if (m?.id) existingMenuConfigIds.add(String(m.id));
                    });
                }
            }

            if (typeof generated?.listAuditLogs === 'function') {
                const aRes = await generated.listAuditLogs(dataConnect);
                const rows = (aRes as any)?.data?.auditLogs ?? [];
                rows.forEach((r: any) => {
                    if (r?.id) existingAuditLogIds.add(String(r.id));
                });
            }

            if (typeof generated?.listAgents === 'function') {
                const aRes = await generated.listAgents(dataConnect);
                const rows = (aRes as any)?.data?.agents ?? [];
                rows.forEach((r: any) => {
                    if (r?.id) existingAgentIds.add(String(r.id));
                });
            }

            if (typeof generated?.listAgentConversations === 'function') {
                const aRes = await generated.listAgentConversations(dataConnect);
                const rows = (aRes as any)?.data?.agentConversations ?? [];
                rows.forEach((r: any) => {
                    if (r?.id) existingAgentConversationIds.add(String(r.id));
                });
            }

            if (typeof generated?.listSettings === 'function') {
                const sRes = await generated.listSettings(dataConnect);
                const rows = (sRes as any)?.data?.settings ?? [];
                rows.forEach((r: any) => {
                    if (r?.id) existingSettingIds.add(String(r.id));
                });
            }

            if (typeof generated?.listSystemConfigs === 'function') {
                const sRes = await generated.listSystemConfigs(dataConnect);
                const rows = (sRes as any)?.data?.systemConfigs ?? [];
                rows.forEach((r: any) => {
                    if (r?.id) existingSystemConfigIds.add(String(r.id));
                });
            }

            if (!ONLY_NEW_COLLECTIONS) {
                console.log(`ℹ️ Preloaded idMap entries: ${Object.keys(idMap).length}`);
                console.log(`ℹ️ Preloaded DailyReportWorker pairs: ${existingDailyReportWorkerPairs.size}`);
                console.log(`ℹ️ Preloaded AppUser rows: ${existingAppUserIds.size}`);
                console.log(`ℹ️ Preloaded MenuConfig rows: ${existingMenuConfigIds.size}`);
            }
            console.log(`ℹ️ Preloaded AuditLog rows: ${existingAuditLogIds.size}`);
            console.log(`ℹ️ Preloaded Agent rows: ${existingAgentIds.size}`);
            console.log(`ℹ️ Preloaded AgentConversation rows: ${existingAgentConversationIds.size}`);
            console.log(`ℹ️ Preloaded Setting rows: ${existingSettingIds.size}`);
            console.log(`ℹ️ Preloaded SystemConfig rows: ${existingSystemConfigIds.size}`);
        } catch (e) {
            console.warn('⚠️ Failed to preload existing Data Connect rows (migration may create duplicates):', e);
        }
    }

    if (!SKIP_POSITIONS && !ONLY_NEW_COLLECTIONS) {
        try {
            const pRes = await listPositions(dataConnect);
            const existingPositions = (pRes as any)?.data?.positions ?? [];
            existingPositions.forEach((p: any) => {
                if (p?.legacyId) existingPositionLegacyIds.add(String(p.legacyId));
            });
            console.log(`ℹ️ Preloaded Position rows: ${existingPositions.length}`);
        } catch (e) {
            console.warn('⚠️ Failed to preload existing Positions (migration may create duplicates):', e);
        }
    }

    if (POSITIONS_ONLY) {
        console.log('ℹ️ Running in --positions-only mode. Other entities will be skipped to avoid duplicates.');
    }

    if (SKIP_DAILY_REPORTS) {
        console.log('ℹ️ Running with --skip-daily-reports. Daily report rows will not be inserted/updated.');
    }

    if (ONLY_NEW_COLLECTIONS) {
        console.log('ℹ️ Running with --only-new-collections. Only audit_logs/agents/agent_conversations/settings/system_config will be migrated.');
    }

    if (!POSITIONS_ONLY && !ONLY_NEW_COLLECTIONS) {
        // 1. Companies
        console.log('\n--- Migrating Companies ---');
        for (const doc of companies) {
            try {
                if (doc?.id && idMap[String(doc.id)]) {
                    continue;
                }
                const res = await createCompany(dataConnect, {
                    legacyId: doc.id ?? null,
                    name: doc.name || 'Unknown Company',
                    code: doc.code || doc.id?.substring(0, 5) || 'CODE',
                    businessNumber: doc.businessNumber || null,
                    ceoName: doc.ceoName || null,
                    type: doc.type || null,
                    status: Status.ACTIVE // Default to ACTIVE
                } as any);
                const newId = res.data.company_insert.id;
                idMap[doc.id] = newId;
                console.log(`✅ Company mapped: ${doc.id} -> ${newId}`);
            } catch (e) {
                console.error(`❌ Failed to migrate company ${doc.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && auditLogs.length > 0) {
        console.log('\n--- Migrating Audit Logs ---');
        for (const doc of auditLogs) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;
                if (existingAuditLogIds.has(id)) continue;

                if (typeof generated?.createAuditLog !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateAuditLog. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const detailsRaw = (doc as any)?.details ?? null;
                const details = detailsRaw == null ? null : (typeof detailsRaw === 'string' ? detailsRaw : JSON.stringify(detailsRaw));

                await generated.createAuditLog(dataConnect, {
                    id,
                    action: doc?.action ?? null,
                    category: doc?.category ?? null,
                    actorId: doc?.actorId ?? null,
                    actorEmail: doc?.actorEmail ?? null,
                    targetId: doc?.targetId ?? null,
                    details,
                    timestamp: toTimestampString(doc?.timestamp)
                } as any);

                existingAuditLogIds.add(id);
            } catch (e) {
                console.error(`❌ Failed to migrate audit log ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && agents.length > 0) {
        console.log('\n--- Migrating Agents ---');
        for (const doc of agents) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;
                if (existingAgentIds.has(id)) continue;

                if (typeof generated?.createAgent !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateAgent. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const caps = Array.isArray(doc?.capabilities) ? doc.capabilities : [];
                const capabilities = JSON.stringify(caps);

                await generated.createAgent(dataConnect, {
                    id,
                    name: doc?.name ?? null,
                    type: doc?.type ?? null,
                    role: doc?.role ?? null,
                    capabilities,
                    systemPrompt: doc?.systemPrompt ?? null,
                    status: doc?.status ?? null
                } as any);

                existingAgentIds.add(id);
            } catch (e) {
                console.error(`❌ Failed to migrate agent ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && agentConversations.length > 0) {
        console.log('\n--- Migrating Agent Conversations ---');
        for (const doc of agentConversations) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;
                if (existingAgentConversationIds.has(id)) continue;

                if (typeof generated?.createAgentConversation !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateAgentConversation. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const messagesRaw = (doc as any)?.messages ?? [];
                const messages = typeof messagesRaw === 'string' ? messagesRaw : JSON.stringify(messagesRaw);

                await generated.createAgentConversation(dataConnect, {
                    id,
                    mainAgentId: doc?.mainAgentId ?? null,
                    userId: doc?.userId ?? null,
                    messages
                } as any);

                existingAgentConversationIds.add(id);
            } catch (e) {
                console.error(`❌ Failed to migrate agent conversation ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && settings.length > 0) {
        console.log('\n--- Migrating Settings ---');
        for (const doc of settings) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;

                if (typeof generated?.createSetting !== 'function' || typeof generated?.updateSetting !== 'function') {
                    console.error('❌ Missing Data Connect mutations: CreateSetting/UpdateSetting. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const dataObj: any = { ...(doc as any) };
                delete dataObj.id;
                const data = JSON.stringify(dataObj);

                if (existingSettingIds.has(id)) {
                    await generated.updateSetting(dataConnect, { id, data } as any);
                } else {
                    await generated.createSetting(dataConnect, { id, data } as any);
                    existingSettingIds.add(id);
                }
            } catch (e) {
                console.error(`❌ Failed to migrate setting ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && systemConfig.length > 0) {
        console.log('\n--- Migrating System Config ---');
        for (const doc of systemConfig) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;

                if (typeof generated?.createSystemConfig !== 'function' || typeof generated?.updateSystemConfig !== 'function') {
                    console.error('❌ Missing Data Connect mutations: CreateSystemConfig/UpdateSystemConfig. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const dataObj: any = { ...(doc as any) };
                delete dataObj.id;
                const data = JSON.stringify(dataObj);

                if (existingSystemConfigIds.has(id)) {
                    await generated.updateSystemConfig(dataConnect, { id, data } as any);
                } else {
                    await generated.createSystemConfig(dataConnect, { id, data } as any);
                    existingSystemConfigIds.add(id);
                }
            } catch (e) {
                console.error(`❌ Failed to migrate system config ${doc?.id}:`, e);
            }
        }
    }

    if (ONLY_NEW_COLLECTIONS) {
        console.log('\n✅ Finished --only-new-collections migration.');
        return;
    }

    if (!POSITIONS_ONLY) {
        console.log('\n--- Migrating Users ---');
        for (const doc of users) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;
                if (existingAppUserIds.has(id)) continue;

                if (typeof generated?.createAppUser !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateAppUser. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const linkedWorkerIds = Array.isArray(doc?.linkedWorkerIds) ? doc.linkedWorkerIds : [];

                await generated.createAppUser(dataConnect, {
                    id,
                    uid: doc?.uid ?? null,
                    email: doc?.email ?? null,
                    displayName: doc?.displayName ?? null,
                    photoUrl: doc?.photoURL ?? null,
                    linkedWorkerIds: JSON.stringify(linkedWorkerIds),
                    role: doc?.role ?? null,
                    lastLogin: toTimestampString(doc?.lastLogin)
                } as any);

                existingAppUserIds.add(id);
            } catch (e) {
                console.error(`❌ Failed to migrate user ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && menus.length > 0) {
        console.log('\n--- Migrating Menu Configs ---');
        for (const doc of menus) {
            try {
                const id = doc?.id ? String(doc.id) : null;
                if (!id) continue;
                if (existingMenuConfigIds.has(id)) continue;

                if (typeof generated?.createMenuConfig !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateMenuConfig. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const configObj = (doc as any)?.config ?? doc;
                const config = typeof configObj === 'string' ? configObj : JSON.stringify(configObj);

                await generated.createMenuConfig(dataConnect, {
                    id,
                    config
                } as any);

                existingMenuConfigIds.add(id);
            } catch (e) {
                console.error(`❌ Failed to migrate menu config ${doc?.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && systemLogs.length > 0) {
        console.log('\n--- Migrating System Logs ---');
        for (const doc of systemLogs) {
            try {
                if (typeof generated?.createSystemLog !== 'function') {
                    console.error('❌ Missing Data Connect mutation: CreateSystemLog. Run: firebase deploy --only dataconnect && firebase dataconnect:sdk:generate');
                    break;
                }

                const category = doc?.category ? String(doc.category) : 'UNKNOWN';
                const action = doc?.action ? String(doc.action) : 'UNKNOWN';
                const userEmail = doc?.userEmail ? String(doc.userEmail) : null;
                const detailsRaw = (doc as any)?.details ?? null;
                const details = detailsRaw == null ? null : (typeof detailsRaw === 'string' ? detailsRaw : JSON.stringify(detailsRaw));

                await generated.createSystemLog(dataConnect, {
                    category,
                    action,
                    userEmail,
                    details
                } as any);
            } catch (e) {
                console.error(`❌ Failed to migrate system log ${doc?.id ?? 'UNKNOWN'}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY) {
        // 2. Sites (Often independent)
        console.log('\n--- Migrating Sites ---');
        for (const doc of sites) {
            try {
                if (doc?.id && idMap[String(doc.id)]) {
                    continue;
                }
                const res = await createSite(dataConnect, {
                    legacyId: doc.id ?? null,
                    name: doc.name || 'Unknown Site',
                    code: doc.code || null,
                    address: doc.address || null,
                    startDate: toDateString(doc.startDate),
                    endDate: toDateString(doc.endDate),
                    status: Status.ACTIVE
                } as any);
                const newId = res.data.site_insert.id;
                idMap[doc.id] = newId;
                console.log(`✅ Site mapped: ${doc.id} -> ${newId}`);
            } catch (e) {
                console.error(`❌ Failed to migrate site ${doc.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY) {
        // 3. Teams (Depends on Company)
        console.log('\n--- Migrating Teams ---');
        for (const doc of teams) {
            try {
                if (doc?.id && idMap[String(doc.id)]) {
                    continue;
                }
                const mappedCompanyId = doc.companyId ? (idMap[doc.companyId] ?? null) : null;
                if (doc.companyId && !mappedCompanyId) {
                    console.warn(`⚠️ Skipping Team ${doc.id}: Company ID ${doc.companyId} not found in map.`);
                    continue;
                }

                const res = await createTeam(dataConnect, {
                    legacyId: doc.id ?? null,
                    name: doc.name || 'Unknown Team',
                    companyId: mappedCompanyId, // Resolve relations
                    type: doc.type || null,
                    status: Status.ACTIVE,
                    totalManDay: typeof doc.totalManDay === 'number' ? doc.totalManDay : 0
                    // leaderId is circular dependency, might need update later or skip for now
                } as any);
                const newId = res.data.team_insert.id;
                idMap[doc.id] = newId;
                console.log(`✅ Team mapped: ${doc.id} -> ${newId}`);
            } catch (e) {
                console.error(`❌ Failed to migrate team ${doc.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY) {
        // 4. Workers (Depends on Team)
        console.log('\n--- Migrating Workers ---');
        for (const doc of workers) {
            try {
                if (doc?.id && idMap[String(doc.id)]) {
                    continue;
                }
                const mappedTeamId = doc.teamId ? (idMap[doc.teamId] ?? null) : null;
                if (doc.teamId && !mappedTeamId) {
                    console.warn(`⚠️ Skipping Worker ${doc.id}: Team ID ${doc.teamId} not found in map.`);
                    continue;
                }

                const res = await createWorker(dataConnect, {
                    legacyId: doc.id ?? null,
                    name: doc.name || 'Unknown Worker',
                    teamId: mappedTeamId,
                    role: doc.role || null,
                    payType: doc.payType || null,
                    unitPrice: typeof doc.unitPrice === 'number' ? doc.unitPrice : 0,
                    residentNumber: doc.residentNumber || null,
                    phone: doc.phone || null,
                    address: doc.address || null,
                    isActive: doc.isActive !== false, // Default true
                    joinDate: toDateString(doc.joinDate)
                } as any);
                const newId = res.data.worker_insert.id;
                idMap[doc.id] = newId;
                console.log(`✅ Worker mapped: ${doc.id} -> ${newId}`);
            } catch (e) {
                console.error(`❌ Failed to migrate worker ${doc.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY) {
        console.log('\n--- Updating Team Leaders ---');
        for (const doc of teams) {
            try {
                const newTeamId = idMap[doc.id];
                const newLeaderId = doc.leaderId ? (idMap[doc.leaderId] ?? null) : null;
                if (!newTeamId || !newLeaderId) continue;

                await updateTeam(dataConnect, {
                    id: newTeamId,
                    leaderId: newLeaderId
                });
                console.log(`✅ Team leader set: ${doc.id} -> leader ${doc.leaderId}`);
            } catch (e) {
                console.error(`❌ Failed to update team leader ${doc.id}:`, e);
            }
        }
    }

    if (!POSITIONS_ONLY && !SKIP_DAILY_REPORTS) {
        // 5. Daily Reports (Depends on Team, Site)
        console.log('\n--- Migrating Daily Reports ---');
        for (const doc of dailyReports) {
            try {
                // Need teamId. If missing, we might skip or assign default?
                const rawTeamId = typeof doc?.teamId === 'string' ? doc.teamId.trim() : doc?.teamId;
                const rawResponsibleTeamId = typeof doc?.responsibleTeamId === 'string' ? doc.responsibleTeamId.trim() : doc?.responsibleTeamId;

                const teamId = (rawTeamId ? (idMap[String(rawTeamId)] ?? null) : null)
                    ?? (rawResponsibleTeamId ? (idMap[String(rawResponsibleTeamId)] ?? null) : null);
                if (!teamId) {
                    console.warn(`⚠️ Skipping DailyReport ${doc.id}: Team ID ${doc.teamId} / responsibleTeamId ${doc.responsibleTeamId} not found in map.`);
                    continue;
                }

                const reportDate = toDateString(doc.date);
                if (!reportDate) {
                    console.warn(`⚠️ Skipping DailyReport ${doc.id}: invalid date value.`);
                    continue;
                }

                const mappedSiteId = doc.siteId ? (idMap[doc.siteId] ?? null) : null;
                if (doc.siteId && !mappedSiteId) {
                    console.warn(`⚠️ DailyReport ${doc.id}: Site ID ${doc.siteId} not found in map. Inserting with null siteId.`);
                }

                const existingReportId = doc?.id ? (idMap[String(doc.id)] ?? null) : null;
                const reportPayload: any = {
                    date: reportDate,
                    teamId: teamId,
                    siteId: mappedSiteId,
                    siteName: doc.siteName || null,
                    status: doc.status || 'draft',
                    writerUid: doc.writerId || null,
                    companyName: doc.companyName || null,
                    responsibleTeamName: doc.responsibleTeamName || null,
                    responsibleTeamLegacyId: doc.responsibleTeamId || null,
                    totalManDay: typeof doc.totalManDay === 'number' ? doc.totalManDay : Number(doc.totalManDay || 0),
                    totalAmount: typeof doc.totalAmount === 'number' ? doc.totalAmount : Number(doc.totalAmount || 0),
                    weather: doc.weather || null,
                    workContent: doc.workContent || null
                };

                let newId: string;
                if (existingReportId) {
                    await updateDailyReport(dataConnect, {
                        id: existingReportId,
                        ...reportPayload
                    } as any);
                    newId = existingReportId;
                } else {
                    const res = await createDailyReport(dataConnect, {
                        legacyId: doc.id ?? null,
                        ...reportPayload
                    } as any);
                    newId = res.data.dailyReport_insert.id;
                    idMap[doc.id] = newId;
                    console.log(`✅ DailyReport mapped: ${doc.id} -> ${newId}`);
                }

                const workerRows = Array.isArray(doc.workers) ? doc.workers : [];
                for (const row of workerRows) {
                    try {
                        const legacyWorkerId = row?.workerId ? String(row.workerId) : null;
                        const manDay = toFloat(row?.manDay, 0);
                        const unitPrice = toFloat(row?.unitPrice, 0);

                        let mappedWorkerId = legacyWorkerId ? (idMap[legacyWorkerId] ?? null) : null;
                        if (!mappedWorkerId) {
                            const isUnknown = !legacyWorkerId || legacyWorkerId === 'unknown';
                            const workerName = row?.name ? String(row.name) : null;
                            if (isUnknown && workerName) {
                                const phLegacyId = placeholderWorkerLegacyId(workerName);
                                mappedWorkerId = idMap[phLegacyId] ?? placeholderWorkerByName[workerName] ?? null;

                                if (!mappedWorkerId) {
                                    const rawRowTeamId = typeof row?.teamId === 'string' ? row.teamId.trim() : row?.teamId;
                                    const mappedRowTeamId = rawRowTeamId ? (idMap[String(rawRowTeamId)] ?? null) : null;

                                    const res = await createWorker(dataConnect, {
                                        legacyId: phLegacyId,
                                        name: workerName,
                                        teamId: mappedRowTeamId,
                                        role: row?.role ?? null,
                                        payType: row?.payType ?? null,
                                        unitPrice,
                                        residentNumber: null,
                                        phone: null,
                                        address: null,
                                        isActive: true,
                                        joinDate: null
                                    } as any);

                                    const insertedId = String(res.data.worker_insert.id);
                                    mappedWorkerId = insertedId;
                                    placeholderWorkerByName[workerName] = insertedId;
                                    idMap[phLegacyId] = insertedId;
                                }
                            }
                        }

                        if (!mappedWorkerId) {
                            console.warn(`⚠️ Skipping DailyReportWorker for report ${doc.id}: Worker ID ${legacyWorkerId} not found in map.`);
                            continue;
                        }
                        const gongsu = manDay;
                        const amount = unitPrice * gongsu;

                        const pk = pairKey(String(newId), String(mappedWorkerId));
                        if (existingDailyReportWorkerPairs.has(pk)) {
                            continue;
                        }

                        await createDailyReportWorker(dataConnect, {
                            dailyReportId: newId,
                            workerId: mappedWorkerId,
                            gongsu,
                            unitPrice,
                            amount,
                            workDescription: null,
                            legacyWorkerId,
                            legacyTeamId: row?.teamId ? String(row.teamId) : null,
                            workerName: row?.name ?? null,
                            role: row?.role ?? null,
                            status: row?.status ?? null,
                            manDay,
                            payType: row?.payType ?? null,
                            salaryModel: row?.salaryModel ?? null,
                            workContent: row?.workContent ?? null
                        } as any);

                        existingDailyReportWorkerPairs.add(pk);
                    } catch (e) {
                        console.error(`❌ Failed to migrate daily report worker row for report ${doc.id}:`, e);
                    }
                }

                // 5.1 Daily Report Workers (Sub-collection or Array in Firestore?)
                // Assuming the backup script flattened them or they are in a separate file.
                // If they are nested in Firestore doc, we access them here.
                // But standard backup script usually exports collections. 
                // If 'daily_report_workers' is a root collection or subcollection, we need to load it.
                // For now, let's assume we load 'daily_report_workers.json' if it was subcollection export
                // BUT our simple backup script might not have handled subcollections deeply? 
                // Let's check if 'dailyReportWorkers' field exists in dailyReport doc or if we have a file.

                // To be safe, if the backup includes subcollection data formatted e.g. "daily_reports/{id}/workers", 
                // we'd need more complex logic. 
                // For this version, let's focus on the top-level entities.

            } catch (e) {
                console.error(`❌ Failed to migrate report ${doc.id}:`, e);
            }
        }
    }

    // 6. Positions (Independent)
    if (SKIP_POSITIONS) {
        console.log('\n--- Skipping Positions (--skip-positions) ---');
    } else {
        console.log('\n--- Migrating Positions ---');
        for (const doc of positions) {
            try {
                const legacyPositionId = doc?.id ? String(doc.id) : null;
                if (legacyPositionId && existingPositionLegacyIds.has(legacyPositionId)) {
                    continue;
                }

                const rawRank = typeof doc.rank === 'number' ? doc.rank : (typeof doc.rank === 'string' ? Number(doc.rank) : NaN);
                const hasNonIntRank = Number.isFinite(rawRank) && !Number.isInteger(rawRank);
                if (ONLY_NON_INT_POSITIONS && !hasNonIntRank) {
                    continue;
                }

                const res = await createPosition(dataConnect, {
                    legacyId: doc.id ?? null,
                    name: doc.name || 'Unknown Position',
                    rank: toInt(doc.rank, 0),
                    color: doc.color || null,
                    icon: doc.icon || null,
                    isDefault: !!doc.isDefault
                } as any);
                if (legacyPositionId) {
                    existingPositionLegacyIds.add(legacyPositionId);
                    idMap[legacyPositionId] = res.data.position_insert.id;
                }
                console.log(`✅ Position mapped: ${doc.id} -> ${res.data.position_insert.id}`);
            } catch (e) {
                console.error(`❌ Failed to migrate position ${doc.id}:`, e);
            }
        }
    }

    console.log('\n🎉 Migration Complete!');
};

migrate();
